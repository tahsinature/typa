import { hierarchyExamples } from "./examples";
import { TreeIcon } from "./icons";

export function EmptyHierarchy({ error, onLoadExample }: { error: string | null; onLoadExample: (source: string) => void }) {
  return (
    <div className="ht-empty">
      <div className="ht-empty-art" aria-hidden="true">
        <span />
        <span />
        <span />
        <TreeIcon width={45} height={45} />
      </div>
      <span className="ht-eyebrow">A little structure. A clearer picture.</span>
      <h2>{error ? "Let’s untangle that input." : "See how everything connects."}</h2>
      <p>{error ?? "Turn people, teams, projects, or folders into an interactive tree. Paste a list, or start with an example."}</p>
      <div className="ht-example-cards">
        {hierarchyExamples.map((example) => (
          <button type="button" key={example.id} onClick={() => onLoadExample(example.source)}>
            <TreeIcon name={example.id === "folders" ? "layers" : example.id === "quantities" ? "plus" : "tree"} />
            <strong>{example.name}</strong>
            <span>{example.description}</span>
            <TreeIcon name="chevron" width={13} height={13} />
          </button>
        ))}
      </div>
    </div>
  );
}
