import { expect, test } from "bun:test";
import { Position } from "@xyflow/react";
import { parseHierarchy } from "@typa/engine";
import { ancestorEdgeIds, diagramEdgeStyle } from "../src/components/diagram/diagram-style";
import { applyBoardPositions, boardPositions } from "../src/viewers/hierarchy-tree/board-positions";
import { layoutHierarchy } from "../src/viewers/hierarchy-tree/model";

const tree = parseHierarchy('Studio\n  Product\n    Maya\n    Leo\n  Engineering\n    Web\n      Aisha\n      Alex\n    Platform\n      Sam');

for (const direction of ["LR", "TB"] as const) {
  for (const compact of [false, true]) {
    test(`${direction} ${compact ? 'compact' : 'regular'} layout keeps leaf groups and correctly routed connectors`, () => {
      const graph = layoutHierarchy(tree, new Set(), '', direction, compact);
      const leaves = graph.nodes.filter(node => node.kind === 'leaves');
      expect(leaves).toHaveLength(3);
      expect(leaves.flatMap(node => node.sections.flatMap(section => section.columns.flat().map(entry => entry.name))).sort()).toEqual(['Aisha', 'Alex', 'Leo', 'Maya', 'Sam']);
      for (const node of graph.nodes) {
        expect(node.sourcePosition).toBe(direction === 'LR' ? Position.Right : Position.Bottom);
        expect(node.targetPosition).toBe(direction === 'LR' ? Position.Left : Position.Top);
        expect(node.width).toBeGreaterThan(0);
        expect(node.height).toBeGreaterThan(0);
      }
      expect(graph.edges.length).toBeGreaterThan(0);
      for (const edge of graph.edges) {
        expect(edge.type).toBe('smoothstep');
        const source = graph.nodes.find(node => node.id === edge.source)!;
        const target = graph.nodes.find(node => node.id === edge.target)!;
        if (direction === 'LR') expect(source.position.x + source.width).toBeLessThan(target.position.x);
        else expect(source.position.y + source.height).toBeLessThan(target.position.y);
      }
    });
  }
}

test('selection highlights the ancestor path without including sibling branches', () => {
  const graph = layoutHierarchy(tree, new Set(), '', 'LR', false);
  const selected = graph.nodes.find(node => node.sections.some(section => section.columns.flat().some(entry => entry.name === 'Aisha')))!;
  const path = ancestorEdgeIds(graph.edges, selected.id);
  expect(path.size).toBeGreaterThan(1);
  expect(path.has(graph.edges.find(edge => edge.target === selected.id)!.id)).toBe(true);
  const sibling = graph.nodes.find(node => node.sections.some(section => section.columns.flat().some(entry => entry.name === 'Maya')))!;
  expect(path.has(graph.edges.find(edge => edge.target === sibling.id)!.id)).toBe(false);
  expect(ancestorEdgeIds(graph.edges, null).size).toBe(0);
  expect(diagramEdgeStyle(true)).toEqual({ stroke: '#a78bfa', strokeWidth: 2.5 });
});

test('collapsed branches stay collapsed and search still reveals matching leaves', () => {
  const product = tree.nodes.find(node => node.name === 'Product')!;
  const collapsed = new Set([product.id]);
  const graph = layoutHierarchy(tree, collapsed, '', 'TB', false);
  expect(graph.nodes.flatMap(node => node.sections.flatMap(section => section.columns.flat().map(entry => entry.name)))).not.toContain('Maya');
  const searched = layoutHierarchy(tree, collapsed, 'Maya', 'TB', false);
  expect(searched.nodes.flatMap(node => node.sections.flatMap(section => section.columns.flat().map(entry => entry.name)))).toContain('Maya');
});

test('balanced layout keeps grouped cards without connectors', () => {
  const graph = layoutHierarchy(tree, new Set(), '', 'BALANCED', false);
  expect(graph.nodes.some(node => node.kind === 'card')).toBe(true);
  expect(graph.edges).toEqual([]);
});

for (const compact of [false, true]) {
  test(`balanced ${compact ? 'compact' : 'regular'} collapse and expand keep positions, rearrange packs, reset restores`, () => {
    const families = parseHierarchy(Array.from({ length: 10 }, (_, i) => `Family ${i}\n  Household\n    Person ${i}\n    Guest ${i}\n    Child ${i}`).join('\n'));
    const initial = layoutHierarchy(families, new Set(), '', 'BALANCED', compact);
    const positions = boardPositions(initial);
    const collapsed = new Set(families.nodes.filter(node => node.children.length).map(node => node.id));
    const computed = layoutHierarchy(families, collapsed, '', 'BALANCED', compact);
    const fixed = applyBoardPositions(computed, positions);
    expect(fixed.nodes.map(node => node.position)).toEqual(initial.nodes.map(node => node.position));
    expect(fixed.nodes.find(node => node.kind === 'card')!.height).toBeLessThan(initial.nodes.find(node => node.kind === 'card')!.height);
    expect(fixed.edges).toEqual([]);

    const rearranged = boardPositions(computed);
    expect([...rearranged.values()]).not.toEqual([...positions.values()]);
    const expanded = applyBoardPositions(initial, rearranged);
    for (const node of expanded.nodes) expect(node.position).toEqual(rearranged.get(node.id)!);
    const reset = applyBoardPositions(computed, positions);
    expect(reset.nodes.map(node => node.position)).toEqual(initial.nodes.map(node => node.position));
    expect(reset.nodes.map(node => node.sections)).toEqual(computed.nodes.map(node => node.sections));
    for (const node of expanded.nodes) {
      expect(expanded.bounds.width).toBeGreaterThanOrEqual(node.position.x + node.width);
      expect(expanded.bounds.height).toBeGreaterThanOrEqual(node.position.y + node.height);
    }

    // Collapsing a nested section updates content and its row anchors without moving cards.
    const household = families.nodes.find(node => node.name === 'Household')!;
    const nested = applyBoardPositions(layoutHierarchy(families, new Set([household.id]), '', 'BALANCED', compact), positions);
    expect(nested.nodes.map(node => node.position)).toEqual(initial.nodes.map(node => node.position));
    const moved = applyBoardPositions(initial, new Map([...positions].map(([id, point]) => [id, { x: point.x + 100, y: point.y + 75 }])));
    for (const [id, point] of initial.anchors) expect(moved.anchors.get(id)).toEqual({ x: point.x + 100, y: point.y + 75 });
  });
}

test('dragged cards left or above the origin remain inside export bounds', () => {
  const initial = layoutHierarchy(tree, new Set(), '', 'BALANCED', false);
  const positions = boardPositions(initial);
  const card = initial.nodes.find(node => node.kind === 'card')!;
  positions.set(card.id, { x: -420, y: -280 });
  const moved = applyBoardPositions(initial, positions);
  expect(moved.bounds.x).toBe(-452);
  expect(moved.bounds.y).toBe(-312);
  for (const node of moved.nodes) {
    expect(moved.bounds.x).toBeLessThanOrEqual(node.position.x);
    expect(moved.bounds.y).toBeLessThanOrEqual(node.position.y);
    expect(moved.bounds.x + moved.bounds.width).toBeGreaterThanOrEqual(node.position.x + node.width);
    expect(moved.bounds.y + moved.bounds.height).toBeGreaterThanOrEqual(node.position.y + node.height);
  }
  const collapsed = applyBoardPositions(layoutHierarchy(tree, new Set([card.id]), '', 'BALANCED', false), positions);
  expect(collapsed.nodes.find(node => node.id === card.id)!.position).toEqual({ x: -420, y: -280 });
});
