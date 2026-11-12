import { useState } from "react";
import { hierarchyExamples } from "./examples";

export function ExamplePicker({ onLoad }: { onLoad: (source: string) => void }) {
  const [example, setExample] = useState("people");
  return (
    <div className="ht-example-select">
      <select aria-label="Example to load" value={example} onChange={(event) => setExample(event.target.value)}>
        {hierarchyExamples.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="ht-button"
        title="Replace the outline with fictional example data (undo available)"
        onClick={() => onLoad(hierarchyExamples.find((item) => item.id === example)!.source)}
      >
        Load example
      </button>
    </div>
  );
}
