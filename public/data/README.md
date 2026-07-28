# data/

Source of truth for the genealogy graph. The page reads `manifest.json` and loads
every file it lists, in order — nothing is hard-coded in the HTML.

    manifest.json          load order + lane labels
    schema.json            field-by-field record spec
    nodes/<domain>.json    one file per research domain, one model per line
    edges/relations.json   every relationship, one per line

## Add a model

1. Append one line to the right `nodes/<domain>.json`.
2. Give it a unique `id`, a `y` (year), a `lane`, a `tr` (track) and a size `s`.
3. Add its lineage to `edges/relations.json` (`f` → `t`).

Reload — layout, routing and the audit run themselves. An edge whose endpoint
id does not exist is skipped, never fatal.

## Add a domain

Add the lane to `LANES` in the page, then a `nodes/` file and a `manifest.json` entry.
