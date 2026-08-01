# Takeoff V2 Wall-First Architecture

```text
Import PDF
  -> Rotate correctly
  -> Confirm scale
  -> Detect wall objects
  -> Review wall objects
  -> Generate exterior perimeter from wall graph
  -> Review exterior
  -> Detect rooms from wall graph
  -> Review rooms
  -> Detect openings and attach each to one wall
  -> Review doors/windows
  -> Measurements
  -> Quantities
```

Stage 1 implemented here:

```text
PDF vector/raster linework
  -> reject dimensions/title blocks/symbols/page borders
  -> pair parallel wall faces where possible
  -> preserve single-stroke wall candidates
  -> create Wall objects
  -> classify exterior/interior/unknown heuristically
  -> compute wall-to-wall connectivity
  -> display color-coded wall objects
```

Later stages must use these wall objects as the source of truth. Exterior
perimeters, rooms, and openings should be derived from reviewed walls rather
than from whole-page polygon detection.
