import { parseHierarchy, hierarchyToJson } from "../hierarchy";
import { registerTransform } from "./registry";

registerTransform({
  id: "hierarchy-tree",
  name: "Hierarchy Tree",
  description: "Visualize and count people, guest lists, teams, org charts, projects, folders, and nested outlines",
  category: "Diagram",
  inputViews: [],
  outputViews: ["hierarchy-tree", "raw-output"],
  tips: [
    "Paste an indented list or JSON with name and children fields. Bullets and numbering are optional.",
    "Use tabs or spaces to nest entries. Duplicate names remain separate entries.",
    "Write Kids :: 3 to assign a quantity. Quantities are summed across leaves only.",
    "Collapsing a branch changes its appearance, never its counts. The overview node is excluded from counts.",
  ],
  fn: (input) => {
    const hierarchy = parseHierarchy(input);
    return { text: hierarchy.error ?? hierarchyToJson(hierarchy), data: hierarchy };
  },
});
