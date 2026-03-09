import { registerTransform } from "./registry";

registerTransform({
  id: "image-canvas",
  name: "Image Canvas",
  description: "Arrange, annotate, and compose multiple images on a canvas",
  category: "Image",
  inputs: 1,
  inputViews: [],
  outputViews: ["image-canvas"],
  fn: (input) => input || "[]",
});
