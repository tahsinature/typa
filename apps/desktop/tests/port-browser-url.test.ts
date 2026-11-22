import { expect, test } from "bun:test";
import { getPortBrowserUrl } from "../src/viewers/port-browser-url";

const listener = { port: 15173, protocol: "TCP", state: "LISTEN", local_address: "127.0.0.1:15173" };

test.each([
  ["127.0.0.1:15173", "http://127.0.0.1:15173/"],
  ["[::1]:15173", "http://[::1]:15173/"],
  ["::1:15173", "http://[::1]:15173/"],
  ["192.168.1.5:15173", "http://192.168.1.5:15173/"],
  ["0.0.0.0:15173", "http://127.0.0.1:15173/"],
  ["*:15173", "http://127.0.0.1:15173/"],
  ["[::]:15173", "http://[::1]:15173/"],
  ["[0:0:0:0:0:0:0:0]:15173", "http://[::1]:15173/"],
])("builds a browser destination for %s", (local_address, expected) => {
  expect(getPortBrowserUrl({ ...listener, local_address })).toBe(expected);
});

test("accepts listening aliases and the IPv6 example port", () => {
  expect(getPortBrowserUrl({ ...listener, port: 1517, local_address: "[::1]:1517", state: "LISTENING", protocol: "tcp" })).toBe("http://[::1]:1517/");
});

test("does not offer browser actions for UDP or connected sockets", () => {
  expect(getPortBrowserUrl({ ...listener, protocol: "UDP" })).toBeNull();
  expect(getPortBrowserUrl({ ...listener, state: "ESTABLISHED" })).toBeNull();
});

test.each(["", "[::1:15173", "127.0.0.1:80", "[fe80::1%lo0]:15173", "http://example.com:15173", "bad/address:15173"])("rejects invalid or unsupported address %s", local_address => {
  expect(getPortBrowserUrl({ ...listener, local_address })).toBeNull();
});

test.each([0, -1, 65536, 1.5])("rejects invalid port %s", port => {
  expect(getPortBrowserUrl({ ...listener, port })).toBeNull();
});
