import MD5 from "crypto-js/md5";
import SHA1 from "crypto-js/sha1";
import SHA256 from "crypto-js/sha256";

export function hashAll(input: string): { md5: string; sha1: string; sha256: string } {
  return {
    md5: MD5(input).toString(),
    sha1: SHA1(input).toString(),
    sha256: SHA256(input).toString(),
  };
}
