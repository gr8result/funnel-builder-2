# AI Plan Takeoff -> Job Setup Field Mapping

This mapping documents the canonical Job Setup fields populated by Export Takeoff to Job Setup.

## Existing canonical fields reused

| Takeoff source | Job Setup key |
| --- | --- |
| Project name | projectName |
| Client name | clientName |
| Site address | projectAddress |
| Ground living area | lowerFloorAreaM2 |
| Second living area | upperFloorAreaM2 |
| Third living area | thirdFloorAreaM2 |
| Ground external walls LM | lowerExternalWallsLm |
| Second external walls LM | upperExternalWallsLm |
| Third external walls LM | thirdExternalWallsLm |
| Total external walls LM | totalExternalWallsLm |
| Ground internal walls LM | lowerInternalWallsLm |
| Second internal walls LM | upperInternalWallsLm |
| Third internal walls LM | thirdInternalWallsLm |
| Total internal walls LM | totalInternalWallsLm |
| Ground eaves LM | lowerEavesLm |
| Second eaves LM | upperEavesLm |
| Third eaves LM | thirdEavesLm |
| Total eaves LM | totalEavesLm |
| Eaves area | eavesAreaM2 |

## Canonical fields added for new takeoff coverage

| Takeoff source | Job Setup key |
| --- | --- |
| Ground/second/third/total brick veneer external LM | lowerBrickVeneerExternalWallsLm, upperBrickVeneerExternalWallsLm, thirdBrickVeneerExternalWallsLm, totalBrickVeneerExternalWallsLm |
| Ground/second/third/total lightweight cladding LM | lowerLightweightCladdingExternalWallsLm, upperLightweightCladdingExternalWallsLm, thirdLightweightCladdingExternalWallsLm, totalLightweightCladdingExternalWallsLm |
| Ground/second/third/total rendered masonry LM | lowerRenderedMasonryExternalWallsLm, upperRenderedMasonryExternalWallsLm, thirdRenderedMasonryExternalWallsLm, totalRenderedMasonryExternalWallsLm |
| Unclassified exterior LM | totalUnclassifiedExteriorWallsLm |
| Window quantity and opening area | windowOpeningsQty, windowOpeningsAreaM2 |
| Door quantity and opening area | doorOpeningsQty, doorOpeningsAreaM2 |
| Ground/second/third/total brick sill LM | lowerBrickSillLengthLm, upperBrickSillLengthLm, thirdBrickSillLengthLm, totalBrickSillLengthLm |
| Ground/second/third/total gross plasterboard wall area | lowerInternalWallGrossPlasterboardM2, upperInternalWallGrossPlasterboardM2, thirdInternalWallGrossPlasterboardM2, totalInternalWallGrossPlasterboardM2 |
| Ground/second/third/total net plasterboard wall area | lowerInternalWallNetPlasterboardM2, upperInternalWallNetPlasterboardM2, thirdInternalWallNetPlasterboardM2, totalInternalWallNetPlasterboardM2 |
| Floor finishes by type | floorFinishTilesM2, floorFinishCarpetsM2, floorFinishHybridM2, floorFinishPolishedConcreteM2, floorFinishExposedAggM2 |

## Provenance fields

Export takes and stores provenance in the takeoff engine sync state:
- takeoffId
- revision
- transferredAt

## Notes

- Export is blocked unless the takeoff is attached to a platform project.
- Mapping preview is shown before transfer and missing values are flagged.
- Re-export updates the same Job Setup keys (no duplicate destination keys).
- Internal plasterboard is reported as gross and net separately. Opening deductions can be toggled per internal wall.
