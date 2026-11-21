//! Image Converter and Image Resize: decode (PNG, JPEG, WebP, GIF, BMP, TIFF, ICO, and SVG rendered with resvg),
//! resize, and encode (PNG, JPEG, WebP lossy/lossless, GIF, BMP, TIFF, multi-size ICO).
//!
//! The image travels as a raw IPC body (no JSON number arrays); options ride in the `x-devkit-options` header.
//! The response is the encoded file, prefixed with 8 bytes: output width and height (u32 little-endian).

use image::codecs::{bmp::BmpEncoder, gif::GifEncoder, ico::IcoEncoder, ico::IcoFrame, jpeg::JpegEncoder, png::PngEncoder, tiff::TiffEncoder};
use image::{imageops::FilterType, DynamicImage, ExtendedColorType, ImageEncoder, RgbaImage};
use serde::{Deserialize, Serialize};
use std::io::Cursor;
use tauri::ipc::{InvokeBody, Request, Response};

const MAX_INPUT: usize = 200 * 1024 * 1024;
const MAX_SIDE: u32 = 16_384;

#[derive(Deserialize, Default, Debug, Clone, Copy, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum Fit {
    /// Fit inside width × height, keep the aspect ratio.
    #[default]
    Fit,
    /// Cover width × height, keep the aspect ratio, crop the overflow (centred).
    Fill,
    /// Exactly width × height (may distort).
    Exact,
}

#[derive(Deserialize, Default, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Resize {
    pub width: Option<u32>,
    pub height: Option<u32>,
    /// Scale in percent (1–1000); used when width and height are both empty.
    pub percent: Option<f32>,
    #[serde(default)]
    pub fit: Fit,
    /// Never make an image bigger than it is (rasters only; SVG has no native pixel size worth keeping).
    #[serde(default)]
    pub allow_upscale: bool,
}

#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Options {
    /// png | jpeg | webp | gif | bmp | tiff | ico
    pub format: String,
    #[serde(default = "default_quality")]
    pub quality: u8,
    #[serde(default)]
    pub lossless: bool,
    /// RGB used under transparent pixels for formats without alpha (JPEG, BMP). Default white.
    pub background: Option<[u8; 3]>,
    pub resize: Option<Resize>,
    /// ICO only: square sizes to include (16–256).
    #[serde(default)]
    pub ico_sizes: Vec<u32>,
}

fn default_quality() -> u8 {
    85
}

#[derive(Serialize, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ImageInfo {
    pub format: String,
    pub width: u32,
    pub height: u32,
    pub has_alpha: bool,
}

fn body(request: &Request<'_>) -> Result<Vec<u8>, String> {
    match request.body() {
        InvokeBody::Raw(b) if b.len() <= MAX_INPUT => Ok(b.clone()),
        InvokeBody::Raw(_) => Err("That file is over 200 MB.".into()),
        _ => Err("Expected the image as raw bytes.".into()),
    }
}

/// SVG when the text (after BOM/whitespace, an XML declaration or comments) contains an <svg element.
pub fn is_svg(data: &[u8]) -> bool {
    let head = String::from_utf8_lossy(&data[..data.len().min(4096)]);
    let t = head.trim_start_matches('\u{feff}').trim_start();
    (t.starts_with('<') && t.contains("<svg")) || t.starts_with("<svg")
}

/// Target size for an image of `w`×`h` under `r` (None = unchanged). Returns (width, height) before any crop.
pub fn target_size(w: u32, h: u32, r: &Resize, raster: bool) -> (u32, u32) {
    let (fw, fh) = (w as f64, h as f64);
    let (tw, th) = match (r.width, r.height) {
        (Some(tw), Some(th)) => match r.fit {
            Fit::Exact => (tw as f64, th as f64),
            Fit::Fit => {
                let s = (tw as f64 / fw).min(th as f64 / fh);
                (fw * s, fh * s)
            }
            Fit::Fill => {
                let s = (tw as f64 / fw).max(th as f64 / fh);
                (fw * s, fh * s)
            }
        },
        (Some(tw), None) => (tw as f64, fh * tw as f64 / fw),
        (None, Some(th)) => (fw * th as f64 / fh, th as f64),
        (None, None) => {
            let p = r.percent.unwrap_or(100.0).clamp(1.0, 1000.0) as f64 / 100.0;
            (fw * p, fh * p)
        }
    };
    let (mut tw, mut th) = (tw.round().max(1.0), th.round().max(1.0));
    if raster && !r.allow_upscale && (tw > fw || th > fh) && r.fit != Fit::Exact {
        let s = (fw / tw).min(fh / th);
        tw = (tw * s).round().max(1.0);
        th = (th * s).round().max(1.0);
    }
    (tw.min(MAX_SIDE as f64) as u32, th.min(MAX_SIDE as f64) as u32)
}

fn render_svg(data: &[u8], resize: Option<&Resize>) -> Result<RgbaImage, String> {
    let mut opt = resvg::usvg::Options::default();
    opt.fontdb_mut().load_system_fonts();
    let tree = resvg::usvg::Tree::from_data(data, &opt).map_err(|e| format!("Not a valid SVG: {e}"))?;
    let size = tree.size();
    let (w, h) = (size.width().ceil().max(1.0) as u32, size.height().ceil().max(1.0) as u32);
    let (tw, th) = resize.map(|r| target_size(w, h, r, false)).unwrap_or((w, h));
    let mut pixmap = resvg::tiny_skia::Pixmap::new(tw, th).ok_or("The SVG has no size to render.")?;
    let transform = resvg::tiny_skia::Transform::from_scale(tw as f32 / size.width(), th as f32 / size.height());
    resvg::render(&tree, transform, &mut pixmap.as_mut());
    let mut out = RgbaImage::new(tw, th);
    for (px, p) in out.pixels_mut().zip(pixmap.pixels()) {
        let c = p.demultiply();
        *px = image::Rgba([c.red(), c.green(), c.blue(), c.alpha()]);
    }
    Ok(out)
}

fn decode(data: &[u8], resize: Option<&Resize>) -> Result<(DynamicImage, bool), String> {
    if is_svg(data) {
        return Ok((DynamicImage::ImageRgba8(render_svg(data, resize)?), true));
    }
    let img = image::ImageReader::new(Cursor::new(data))
        .with_guessed_format()
        .map_err(|e| e.to_string())?
        .decode()
        .map_err(|e| format!("Couldn't read the image: {e}"))?;
    Ok((img, false))
}

fn apply_resize(img: DynamicImage, r: &Resize) -> DynamicImage {
    let (w, h) = (img.width(), img.height());
    let (tw, th) = target_size(w, h, r, true);
    if (tw, th) == (w, h) {
        return img;
    }
    let resized = img.resize_exact(tw, th, FilterType::Lanczos3);
    match (r.fit, r.width, r.height) {
        (Fit::Fill, Some(cw), Some(ch)) if tw >= cw && th >= ch => {
            let (x, y) = ((tw - cw) / 2, (th - ch) / 2);
            resized.crop_imm(x, y, cw, ch)
        }
        _ => resized,
    }
}

/// Pastes `img` on an opaque background (for formats without alpha).
fn flatten(img: &RgbaImage, bg: [u8; 3]) -> image::RgbImage {
    image::RgbImage::from_fn(img.width(), img.height(), |x, y| {
        let p = img.get_pixel(x, y).0;
        let a = p[3] as u32;
        let mix = |c: u8, b: u8| ((c as u32 * a + b as u32 * (255 - a) + 127) / 255) as u8;
        image::Rgb([mix(p[0], bg[0]), mix(p[1], bg[1]), mix(p[2], bg[2])])
    })
}

/// A square ICO frame: fits the image inside `size`×`size` on transparency.
fn ico_square(img: &DynamicImage, size: u32) -> RgbaImage {
    let fitted = img.resize(size, size, FilterType::Lanczos3).to_rgba8();
    let mut canvas = RgbaImage::new(size, size);
    let (x, y) = ((size - fitted.width()) / 2, (size - fitted.height()) / 2);
    image::imageops::overlay(&mut canvas, &fitted, x as i64, y as i64);
    canvas
}

pub fn encode(img: &DynamicImage, o: &Options) -> Result<Vec<u8>, String> {
    let mut out = Vec::new();
    let rgba = img.to_rgba8();
    let (w, h) = rgba.dimensions();
    let err = |e: image::ImageError| e.to_string();
    match o.format.as_str() {
        "png" => PngEncoder::new(&mut out).write_image(&rgba, w, h, ExtendedColorType::Rgba8).map_err(err)?,
        "jpeg" | "jpg" => {
            let rgb = flatten(&rgba, o.background.unwrap_or([255, 255, 255]));
            JpegEncoder::new_with_quality(&mut out, o.quality.clamp(1, 100)).write_image(&rgb, w, h, ExtendedColorType::Rgb8).map_err(err)?
        }
        "webp" => {
            if o.lossless {
                image::codecs::webp::WebPEncoder::new_lossless(&mut out).write_image(&rgba, w, h, ExtendedColorType::Rgba8).map_err(err)?
            } else {
                out = webp::Encoder::from_rgba(&rgba, w, h).encode(o.quality.clamp(1, 100) as f32).to_vec();
            }
        }
        "gif" => GifEncoder::new(&mut out).encode(&rgba, w, h, ExtendedColorType::Rgba8).map_err(err)?,
        "bmp" => {
            let rgb = flatten(&rgba, o.background.unwrap_or([255, 255, 255]));
            BmpEncoder::new(&mut out).write_image(&rgb, w, h, ExtendedColorType::Rgb8).map_err(err)?
        }
        "tiff" => TiffEncoder::new(Cursor::new(&mut out)).write_image(&rgba, w, h, ExtendedColorType::Rgba8).map_err(err)?,
        "ico" => {
            let mut sizes: Vec<u32> = o.ico_sizes.iter().copied().filter(|s| (16..=256).contains(s)).collect();
            if sizes.is_empty() {
                sizes = vec![16, 32, 48, 256];
            }
            sizes.sort_unstable();
            sizes.dedup();
            let frames = sizes
                .iter()
                .map(|&s| {
                    let sq = ico_square(img, s);
                    IcoFrame::as_png(&sq, s, s, ExtendedColorType::Rgba8).map_err(err)
                })
                .collect::<Result<Vec<_>, _>>()?;
            IcoEncoder::new(&mut out).encode_images(&frames).map_err(err)?
        }
        other => return Err(format!("Can't write {other} files.")),
    }
    Ok(out)
}

/// Decode → resize → encode. Pure, so it's testable without Tauri.
pub fn convert(data: &[u8], o: &Options) -> Result<(Vec<u8>, u32, u32), String> {
    let (img, from_svg) = decode(data, o.resize.as_ref())?;
    let img = match (&o.resize, from_svg) {
        (Some(r), false) => apply_resize(img, r),
        _ => img,
    };
    let bytes = encode(&img, o)?;
    let (w, h) = if o.format == "ico" { (0, 0) } else { (img.width(), img.height()) };
    Ok((bytes, w, h))
}

#[tauri::command]
pub async fn image_convert(request: Request<'_>) -> Result<Response, String> {
    let data = body(&request)?;
    let opts: Options = request
        .headers()
        .get("x-devkit-options")
        .and_then(|v| v.to_str().ok())
        .ok_or("Missing options")
        .and_then(|s| serde_json::from_str(s).map_err(|_| "Bad options"))?;
    let (bytes, w, h) = tauri::async_runtime::spawn_blocking(move || convert(&data, &opts))
        .await
        .map_err(|e| e.to_string())??;
    let mut out = Vec::with_capacity(bytes.len() + 8);
    out.extend_from_slice(&w.to_le_bytes());
    out.extend_from_slice(&h.to_le_bytes());
    out.extend_from_slice(&bytes);
    Ok(Response::new(out))
}

pub fn info(data: &[u8]) -> Result<ImageInfo, String> {
    if is_svg(data) {
        let tree = resvg::usvg::Tree::from_data(data, &resvg::usvg::Options::default()).map_err(|e| format!("Not a valid SVG: {e}"))?;
        let s = tree.size();
        return Ok(ImageInfo { format: "svg".into(), width: s.width().ceil() as u32, height: s.height().ceil() as u32, has_alpha: true });
    }
    let reader = image::ImageReader::new(Cursor::new(data)).with_guessed_format().map_err(|e| e.to_string())?;
    let format = reader.format().map(|f| format!("{f:?}").to_lowercase()).unwrap_or_else(|| "unknown".into());
    let img = reader.decode().map_err(|e| format!("Couldn't read the image: {e}"))?;
    Ok(ImageInfo { format, width: img.width(), height: img.height(), has_alpha: img.color().has_alpha() })
}

#[tauri::command]
pub async fn image_info(request: Request<'_>) -> Result<ImageInfo, String> {
    let data = body(&request)?;
    tauri::async_runtime::spawn_blocking(move || info(&data)).await.map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;

    const SVG: &str = r##"<svg xmlns="http://www.w3.org/2000/svg" width="24" height="12" viewBox="0 0 24 12"><rect width="24" height="12" fill="#f5a524"/></svg>"##;

    fn png(w: u32, h: u32) -> Vec<u8> {
        let img = RgbaImage::from_pixel(w, h, image::Rgba([10, 20, 30, 128]));
        encode(&DynamicImage::ImageRgba8(img), &opts("png")).unwrap()
    }

    fn opts(format: &str) -> Options {
        Options { format: format.into(), quality: 80, lossless: false, background: None, resize: None, ico_sizes: vec![] }
    }

    #[test]
    fn sizes() {
        let r = |w, h, fit| Resize { width: w, height: h, percent: None, fit, allow_upscale: false };
        assert_eq!(target_size(400, 200, &r(Some(100), None, Fit::Fit), true), (100, 50));
        assert_eq!(target_size(400, 200, &r(None, Some(50), Fit::Fit), true), (100, 50));
        assert_eq!(target_size(400, 200, &r(Some(100), Some(100), Fit::Fit), true), (100, 50));
        assert_eq!(target_size(400, 200, &r(Some(100), Some(100), Fit::Fill), true), (200, 100));
        assert_eq!(target_size(400, 200, &r(Some(100), Some(100), Fit::Exact), true), (100, 100));
        // No upscaling of rasters unless allowed; SVGs scale freely.
        assert_eq!(target_size(100, 50, &r(Some(400), None, Fit::Fit), true), (100, 50));
        assert_eq!(target_size(100, 50, &r(Some(400), None, Fit::Fit), false), (400, 200));
        let pct = Resize { width: None, height: None, percent: Some(50.0), fit: Fit::Fit, allow_upscale: false };
        assert_eq!(target_size(400, 200, &pct, true), (200, 100));
    }

    #[test]
    fn detects_svg() {
        assert!(is_svg(SVG.as_bytes()));
        assert!(is_svg(b"\xEF\xBB\xBF<?xml version=\"1.0\"?>\n<svg/>"));
        assert!(!is_svg(&png(2, 2)));
    }

    #[test]
    fn svg_to_every_format() {
        for f in ["png", "jpeg", "webp", "gif", "bmp", "tiff", "ico"] {
            let mut o = opts(f);
            o.resize = Some(Resize { width: Some(48), height: None, percent: None, fit: Fit::Fit, allow_upscale: false });
            let (bytes, w, h) = convert(SVG.as_bytes(), &o).unwrap_or_else(|e| panic!("{f}: {e}"));
            assert!(!bytes.is_empty(), "{f}");
            if f != "ico" {
                assert_eq!((w, h), (48, 24), "{f}");
                let back = image::load_from_memory(&bytes).unwrap();
                assert_eq!((back.width(), back.height()), (48, 24), "{f}");
            }
        }
    }

    #[test]
    fn resizes_and_fills() {
        let src = png(400, 200);
        let mut o = opts("png");
        o.resize = Some(Resize { width: Some(100), height: Some(100), percent: None, fit: Fit::Fill, allow_upscale: false });
        let (_, w, h) = convert(&src, &o).unwrap();
        assert_eq!((w, h), (100, 100));
        o.resize = Some(Resize { width: None, height: None, percent: Some(25.0), fit: Fit::Fit, allow_upscale: false });
        assert_eq!(convert(&src, &o).map(|r| (r.1, r.2)).unwrap(), (100, 50));
    }

    #[test]
    fn jpeg_flattens_alpha_on_the_background() {
        let mut o = opts("jpeg");
        o.background = Some([0, 0, 0]);
        let (bytes, ..) = convert(&png(4, 4), &o).unwrap();
        let px = image::load_from_memory(&bytes).unwrap().to_rgb8().get_pixel(1, 1).0;
        // 50 % alpha over black halves the colour (JPEG rounding aside).
        assert!(px[2] < 25, "{px:?}");
    }

    #[test]
    fn lossy_webp_is_smaller_than_lossless() {
        let img = RgbaImage::from_fn(256, 256, |x, y| image::Rgba([(x * 7) as u8, (y * 3) as u8, ((x ^ y) * 5) as u8, 255]));
        let src = encode(&DynamicImage::ImageRgba8(img), &opts("png")).unwrap();
        let lossy = convert(&src, &opts("webp")).unwrap().0;
        let mut ll = opts("webp");
        ll.lossless = true;
        let lossless = convert(&src, &ll).unwrap().0;
        assert!(lossy.len() < lossless.len(), "{} vs {}", lossy.len(), lossless.len());
    }

    #[test]
    fn ico_holds_every_size() {
        let mut o = opts("ico");
        o.ico_sizes = vec![16, 32, 48, 300, 32];
        let (bytes, ..) = convert(SVG.as_bytes(), &o).unwrap();
        // ICONDIR: reserved(2) type(2) count(2) — 300 is dropped, 32 deduplicated.
        assert_eq!(u16::from_le_bytes([bytes[4], bytes[5]]), 3);
    }

    #[test]
    fn reports_info_and_rejects_garbage() {
        assert_eq!(info(&png(7, 3)).unwrap(), ImageInfo { format: "png".into(), width: 7, height: 3, has_alpha: true });
        assert_eq!(info(SVG.as_bytes()).unwrap().format, "svg");
        assert!(info(b"not an image").is_err());
        assert!(convert(&png(2, 2), &opts("heic")).is_err());
    }
}
