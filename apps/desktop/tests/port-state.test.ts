import { expect, test } from "bun:test";
import { filterPortStates, normalizeState } from "../src/viewers/port-state";

const ports = [
  { name: "node", state: "LISTENING" },
  { name: "node", state: "ESTAB" },
  { name: "other", state: "CLOSE_WAIT" },
  { name: "other", state: "" },
];

test("multiple selected states are combined and respect a text-filtered list", () => {
  const searchResults = ports.filter(port => port.name.includes("node"));
  expect(filterPortStates(searchResults, ["LISTEN", "ESTABLISHED"])).toEqual(ports.slice(0, 2));
  expect(filterPortStates(searchResults, ["ESTABLISHED"])).toEqual([ports[1]]);
  expect(filterPortStates(searchResults, ["CLOSE_WAIT"])).toEqual([]);
});

test("clearing the selection restores all states, including unknown", () => {
  expect(filterPortStates(ports, [])).toEqual(ports);
  expect(filterPortStates(ports, ["UNKNOWN"])).toEqual([ports[3]]);
});

test("an absent selected state returns no results until it appears again", () => {
  expect(filterPortStates(ports, ["TIME_WAIT"])).toEqual([]);
  const refreshed = [...ports, { name: "node", state: "TIMEWAIT" }];
  expect(filterPortStates(refreshed, ["TIME_WAIT"])).toEqual([refreshed[4]]);
});

test("normalizes platform aliases and preserves unrecognized states", () => {
  expect(normalizeState("(listen)")).toBe("LISTEN");
  expect(normalizeState("FIN_WAIT_2")).toBe("FIN_WAIT");
  expect(normalizeState("CLOSING")).toBe("CLOSING");
});
