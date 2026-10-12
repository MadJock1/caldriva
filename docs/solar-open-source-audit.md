# Solar Open-Source And Imagery Audit

Reviewed 2026-10-11 from local checkouts of the referenced repositories. This is a compatibility review, not a model-accuracy validation.

## Decision

Caldriva retains manual roof geometry as the trusted design path. No external project is integrated as a residential roof-plane or shading service in this milestone.

| Project | Relevant capability | License observed | Decision |
|---|---|---|---|
| [opengeos/geoai](https://github.com/opengeos/geoai) | General geospatial ML, GeoTIFF preprocessing, segmentation/detection workflows, solar-panel example producing mask GeoTIFF and optional vectors. | MIT for code. The solar checkpoint is downloaded separately; its training-data provenance was not established in the reviewed source. | Tooling candidate only. A production model needs separately verified weights, labelled held-out evaluation, and licensed imagery. |
| [open-energy-transition/earthpv](https://github.com/open-energy-transition/earthpv) | Sentinel-2 PV evidence mapping, large-array segmentation, candidate GeoParquet/GeoJSON export, and human-validation workflow. | MIT code. Its published detections/capacity outputs carry ODbL obligations due to OSM; referenced building sources can require CC-BY attribution. | Not suitable for sub-metre residential roof boundaries or closed derived-data workflows without legal review. It is a possible regional PV evidence workflow where attribution/share-alike obligations are acceptable. |
| [PiyushBagde/SolarMap](https://github.com/PiyushBagde/SolarMap) | Existing-panel detection notebook using YOLOv8/SAHI; image in, annotated image and count CSV out. No georeferenced roof polygons. | No repository license observed; bundled weight provenance is unclear. The workflow depends on Ultralytics, currently AGPL-3.0 absent a commercial license. | Rejected for Caldriva commercial use. |

## Technical Limits

- GeoAI's default solar example detects existing panel candidates, not roof planes, pitch, height, obstacles, or engineering-grade boundaries.
- EarthPV operates primarily on Sentinel-2 imagery. Ten-metre pixels cannot support sub-metre residential roof claims.
- SolarMap detects existing panels, not usable roof geometry, and cannot establish system design capacity from its count output.
- The Solarvis workflow reference was treated as product/workflow inspiration only. No proprietary code is copied.

## Imagery Rules

Every Caldriva imagery import must retain provider, attribution, license, resolution, capture date where supplied, CRS, stated spatial accuracy, storage/redistribution permission, and AI-processing permission.

- OpenStreetMap tiles in the current map are reference geography only. They are not a licensed aerial-imagery or AI-training source.
- OSM building footprints may be shown as candidate geometry but cannot be treated as verified roof-plane boundaries.
- User-uploaded orthomosaics and GeoTIFFs require CRS/extent validation and a documented right to process and store them.
- Licensed aerial/satellite/Google Solar data adapters must be introduced only after provider terms specifically permit the proposed cache, redistribution, and AI-processing behavior.

## Recommended Architecture

1. Keep Next.js responsible for authenticated editing, project state, and user-facing review.
2. Run any raster/model workflow in an isolated Python FastAPI worker with raster size, CRS, geometry, time, and ownership checks.
3. Return candidate GeoJSON only, with imagery/model provenance, confidence, and `CANDIDATE_READY` state. Users must confirm before it drives placement.
4. Keep metric placement, PVGIS requests, and engineering warnings independently testable in Caldriva.

## Licensing Follow-Up

Before shipping external code, model weights, or imagery-derived output, record the exact source revision, dependency licenses, model/weight license, imagery terms, attributions, output obligations, and commercial SaaS compatibility. Do not bundle ArtCraft, SolarMap, Solarvis, or provider branding/assets.
