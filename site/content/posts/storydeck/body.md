<!--section:write-once-->

**storydeck** is a small React library with one idea: write a piece of content **once**, then render
it through the lens that fits the reader. A busy engineer skims the **article**. A newcomer watches
the **story** assemble as they scroll. In a meeting, you press play on the **deck**. Same source,
three experiences — no duplicated content.

This very page is built with storydeck. Try the **Read · Scroll · Watch** toggle above.

<!--section:read-->

The **Read** lens is a clean, sectioned article: each section is one figure plus your prose, with
sticky, shareable headings. It's server-rendered, so it's the surface search engines and skimmers
love. When a concept spans several build steps, Read shows just the final, fully-composed figure —
no slide-by-slide dump.

<!--section:scroll-->

The **Scroll** lens is scrollytelling: the figure *pins* while the narrative scrolls past it, and
the pinned "stage" advances through the steps as you go — a progress rail tracks where you are. It's
the same grouped steps as the deck, driven by scroll instead of clicks.

<!--section:watch-->

The **Watch** lens plays the same content as an animated, keyboard-driven deck — every step, in
order. One record; three ways to take it in. The reader chooses; you author it once.

<!--section:how-->

Under the hood it's **one data model**. A *section* owns one or more slide **steps** plus authored
prose — group several steps and they collapse to a single figure in Read and play in full in Watch
and Scroll. You **author** in JSON (structure) + Markdown (prose), and you **theme** it by defining
a handful of CSS variables — storydeck hardcodes no colours, so it wears your brand.

storydeck is a footprintjs library — the flowchart pattern's *"one record, many lenses"* idea,
applied to content.
