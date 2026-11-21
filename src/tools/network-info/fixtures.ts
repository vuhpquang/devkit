import type { NetInfoRaw } from "../../lib/system";

/** Anonymised macOS output (documentation addresses, made-up MACs, no real SSID). */
export const RAW: NetInfoRaw = {
  hostname: "dev-mac.local",
  ifconfig: `lo0: flags=8049<UP,LOOPBACK,RUNNING,MULTICAST> mtu 16384
	options=1203<RXCSUM,TXCSUM,TXSTATUS,SW_TIMESTAMP>
	inet 127.0.0.1 netmask 0xff000000
	inet6 ::1 prefixlen 128
	inet6 fe80::1%lo0 prefixlen 64 scopeid 0x1
gif0: flags=8010<POINTOPOINT,MULTICAST> mtu 1280
en4: flags=8863<UP,BROADCAST,SMART,RUNNING,SIMPLEX,MULTICAST> mtu 1500
	ether 02:00:00:00:00:04
	media: none
	status: inactive
en0: flags=8863<UP,BROADCAST,SMART,RUNNING,SIMPLEX,MULTICAST> mtu 1500
	options=6460<TSO4,TSO6,CHANNEL_IO,PARTIAL_CSUM,ZEROINVERT_CSUM>
	ether 02:00:00:00:00:01
	inet6 fe80::1890:df4a:258e:9ab1%en0 prefixlen 64 secured scopeid 0xe
	inet 192.0.2.11 netmask 0xffffff00 broadcast 192.0.2.255
	inet6 2001:db8:40c0::12 prefixlen 64 autoconf secured
	inet6 2001:db8:40c0::34 prefixlen 64 autoconf temporary
	media: autoselect
	status: active
en8: flags=8863<UP,BROADCAST,SMART,RUNNING,SIMPLEX,MULTICAST> mtu 1500
	ether 02:00:00:00:00:08
	inet 198.51.100.20 netmask 0xfffffe00 broadcast 198.51.101.255
	media: autoselect (1000baseT <full-duplex>)
	status: active
bridge0: flags=8863<UP,BROADCAST,SMART,RUNNING,SIMPLEX,MULTICAST> mtu 1500
	ether 02:00:00:00:00:00
	status: inactive
utun3: flags=8051<UP,POINTOPOINT,RUNNING,MULTICAST> mtu 1380
	inet 100.64.0.2 --> 100.64.0.2 netmask 0xffffffff
	inet6 fe80::ce81:b1c:bd2c:69e%utun3 prefixlen 64 scopeid 0x13
`,
  route: `   route to: default
destination: default
       mask: default
    gateway: 192.0.2.1
  interface: en0
      flags: <UP,GATEWAY,DONE,STATIC,PRCLONING,GLOBAL>
`,
  scutil_dns: `DNS configuration

resolver #1
  nameserver[0] : 1.1.1.1
  nameserver[1] : 8.8.8.8
  flags    : Request A records, Request AAAA records
  reach    : 0x00000002 (Reachable)

resolver #2
  domain   : local
  options  : mdns
  timeout  : 5

resolver #3
  domain   : corp.example
  nameserver[0] : 192.0.2.53
  nameserver[1] : 1.1.1.1

DNS configuration (for scoped queries)

resolver #1
  nameserver[0] : 9.9.9.9
  if_index : 14 (en0)
`,
  hardware_ports: `
Hardware Port: AX88179B
Device: en8
Ethernet Address: 02:00:00:00:00:08

Hardware Port: Thunderbolt Bridge
Device: bridge0
Ethernet Address: 02:00:00:00:00:00

Hardware Port: Wi-Fi
Device: en0
Ethernet Address: 02:00:00:00:00:01
`,
  wifi_summary: `<dictionary> {
  BSSID : <redacted>
  InterfaceType : WiFi
  SSID : <redacted>
}`,
};
