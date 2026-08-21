import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PasteSongDialog } from "./PasteSongDialog";

function setup(canReplace = false) {
  const onInsert = vi.fn();
  render(
    <PasteSongDialog
      open
      onOpenChange={vi.fn()}
      canReplace={canReplace}
      onInsert={onInsert}
    />,
  );
  return { onInsert, textarea: screen.getByLabelText(/song lyrics to import/i) };
}

describe("PasteSongDialog", () => {
  it("disables insert until there is something to import", async () => {
    setup();

    expect(screen.getByRole("button", { name: /insert 0 sections/i })).toBeDisabled();
    expect(screen.getByText(/paste your lyrics above/i)).toBeInTheDocument();
  });

  it("previews the parsed split as the user types", async () => {
    const user = userEvent.setup();
    const { textarea } = setup();

    await user.click(textarea);
    await user.paste("Verse 1\nline a\n\nChorus\nline b");

    expect(screen.getByText(/preview — 2 sections/i)).toBeInTheDocument();

    // One row per detected section, each showing its title and first line.
    const rows = screen.getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("Verse 1");
    expect(rows[0]).toHaveTextContent("line a");
    expect(rows[1]).toHaveTextContent("Chorus");
    expect(rows[1]).toHaveTextContent("line b");
  });

  it("hands the parsed sections to onInsert", async () => {
    const user = userEvent.setup();
    const { onInsert, textarea } = setup();

    await user.click(textarea);
    await user.paste("Verse 1\nline a\n\nChorus\nline b");
    await user.click(screen.getByRole("button", { name: /insert 2 sections/i }));

    expect(onInsert).toHaveBeenCalledTimes(1);
    const [sections, mode] = onInsert.mock.calls[0];
    expect(sections).toEqual([
      { type: "verse", title: "Verse 1", lyrics: "line a" },
      { type: "chorus", title: "Chorus", lyrics: "line b" },
    ]);
    // Nothing worth keeping in the editor, so append is the default.
    expect(mode).toBe("append");
  });

  it("offers replace as the default when the editor already has content", async () => {
    const user = userEvent.setup();
    const { onInsert, textarea } = setup(true);

    expect(screen.getByLabelText(/replace existing sections/i)).toBeChecked();

    await user.click(textarea);
    await user.paste("just one stanza");
    await user.click(screen.getByRole("button", { name: /insert 1 section$/i }));

    expect(onInsert.mock.calls[0][1]).toBe("replace");
  });

  it("keeps chord lines when the toggle is turned off", async () => {
    const user = userEvent.setup();
    const { onInsert, textarea } = setup();

    await user.click(textarea);
    await user.paste("Verse 1\nG  D\nAmazing grace");

    // On by default: the chord line is dropped.
    await user.click(screen.getByLabelText(/remove chord lines/i));

    await user.click(screen.getByRole("button", { name: /insert 1 section$/i }));
    expect(onInsert.mock.calls[0][0][0].lyrics).toBe("G  D\nAmazing grace");
  });
});
