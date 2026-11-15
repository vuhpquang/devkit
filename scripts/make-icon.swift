#!/usr/bin/env swift
// DevKit icon: "</>" in amber on a charcoal rounded square. Writes a 1024 px PNG, then
// `npx tauri icon src-tauri/icons/app-icon.png` regenerates every size in src-tauri/icons/.
// Change this script, never the PNGs by hand.
// Usage: swift scripts/make-icon.swift [output.png]
import AppKit

let size: CGFloat = 1024
let out = CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : "src-tauri/icons/app-icon.png"

func color(_ hex: UInt32, _ a: CGFloat = 1) -> CGColor {
    CGColor(srgbRed: CGFloat((hex >> 16) & 0xFF) / 255, green: CGFloat((hex >> 8) & 0xFF) / 255,
            blue: CGFloat(hex & 0xFF) / 255, alpha: a)
}

let cs = CGColorSpace(name: CGColorSpace.sRGB)!
let ctx = CGContext(data: nil, width: Int(size), height: Int(size), bitsPerComponent: 8, bytesPerRow: 0,
                    space: cs, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!

let inset: CGFloat = 100
let tile = CGRect(x: inset, y: inset, width: size - 2 * inset, height: size - 2 * inset)
let tilePath = CGPath(roundedRect: tile, cornerWidth: 185, cornerHeight: 185, transform: nil)

ctx.saveGState()
ctx.setShadow(offset: CGSize(width: 0, height: -10), blur: 28, color: color(0x000000, 0.3))
ctx.addPath(tilePath); ctx.setFillColor(color(0x1E2430)); ctx.fillPath()
ctx.restoreGState()

ctx.saveGState()
ctx.addPath(tilePath); ctx.clip()
let grad = CGGradient(colorsSpace: cs, colors: [color(0x2C3445), color(0x161A23)] as CFArray, locations: [0, 1])!
ctx.drawLinearGradient(grad, start: CGPoint(x: size / 2, y: tile.maxY), end: CGPoint(x: size / 2, y: tile.minY), options: [])
ctx.restoreGState()

let amber = color(0xF5A524)
let amberSoft = color(0xFFC861)
ctx.setLineCap(.round)
ctx.setLineJoin(.round)
ctx.setLineWidth(70)

// "<"
ctx.setStrokeColor(amber)
ctx.move(to: CGPoint(x: 400, y: 680)); ctx.addLine(to: CGPoint(x: 260, y: 512)); ctx.addLine(to: CGPoint(x: 400, y: 344))
ctx.strokePath()
// ">"
ctx.move(to: CGPoint(x: 624, y: 680)); ctx.addLine(to: CGPoint(x: 764, y: 512)); ctx.addLine(to: CGPoint(x: 624, y: 344))
ctx.strokePath()
// "/"
ctx.setStrokeColor(amberSoft)
ctx.move(to: CGPoint(x: 550, y: 676)); ctx.addLine(to: CGPoint(x: 474, y: 348))
ctx.strokePath()

let image = ctx.makeImage()!
let rep = NSBitmapImageRep(cgImage: image)
try! rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: out))
print("wrote \(out)")
