const LIGHT_FITTING = /downlight|pendant|flush mount|batten|wall bracket|wall light|sconce|spotlight|oyster|\bglobe\b/i;
const slug = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const specification = (title, group, options = {}) => ({ title, group, productRequired: false, ...options });
const product = (title, group, productCategory, options = {}) => ({ title, group, productCategory, productRequired: true, ...options });
const section = (key, title, groups) => ({
  key,
  title,
  groups: groups.map(([groupTitle, items]) => ({
    key: slug(`${key}-${groupTitle}`),
    title: groupTitle,
    items: items.map((item) => ({
      ...item,
      key: item.key || slug(`${key}-${groupTitle}-${item.title}`),
      sectionKey: key,
      section: title,
    })),
  })),
});

export const RESIDENTIAL_INCLUSION_STRUCTURE = Object.freeze([
  section("preliminaries-site-works", "Preliminaries & Site Works", [
    ["Professional services", [
      specification("Site establishment", "Professional services"),
      specification("Surveying and set-out", "Professional services"),
      specification("Soil testing", "Professional services"),
      specification("Engineering", "Professional services"),
      specification("Building approvals", "Professional services"),
    ]],
    ["Temporary works and earthworks", [
      specification("Temporary fencing", "Temporary works and earthworks"),
      specification("Temporary services", "Temporary works and earthworks"),
      specification("Site clearing", "Temporary works and earthworks"),
      specification("Excavation", "Temporary works and earthworks"),
      specification("Earthworks", "Temporary works and earthworks"),
      specification("Site drainage", "Temporary works and earthworks"),
      specification("Termite management", "Temporary works and earthworks"),
    ]],
  ]),
  section("concrete-structural", "Concrete & Structural", [
    ["Foundations and framing", [
      specification("Footings", "Foundations and framing"),
      specification("Concrete slab", "Foundations and framing"),
      specification("Reinforcement", "Foundations and framing"),
      specification("Structural steel", "Foundations and framing"),
      specification("Timber framing", "Foundations and framing"),
      specification("Wall framing", "Foundations and framing"),
      specification("Floor framing", "Foundations and framing"),
      specification("Upper-level flooring", "Foundations and framing"),
      specification("Roof trusses", "Foundations and framing"),
      specification("Structural beams", "Foundations and framing"),
      specification("Stair structure", "Foundations and framing"),
    ]],
  ]),
  section("external-walls-cladding", "External Walls & Cladding", [
    ["Masonry and cladding", [
      specification("Brickwork", "Masonry and cladding"),
      product("Brick selection", "Masonry and cladding", "Bricks"),
      specification("Mortar finish", "Masonry and cladding"),
      specification("Render system", "Masonry and cladding"),
      product("Lightweight cladding", "Masonry and cladding", "Cladding"),
      product("Weatherboards", "Masonry and cladding", "Cladding", { namePattern: /weatherboard|linea|scyon|hardie/i }),
      specification("External wall insulation", "Masonry and cladding"),
      product("External wall finish", "Masonry and cladding", "External Paint"),
    ]],
  ]),
  section("roofing", "Roofing", [
    ["Roof covering", [
      product("Roof covering material", "Roof covering", "Roofing"),
      specification("Roof profile", "Roof covering"),
      specification("Roof colour", "Roof covering"),
      product("Fascia", "Roof covering", "Roofing"),
      product("Gutters", "Roof covering", "Roofing"),
      product("Downpipes", "Roof covering", "Roofing"),
      specification("Roof insulation", "Roof covering"),
      specification("Sarking", "Roof covering"),
      specification("Roof ventilation", "Roof covering"),
      specification("Roof flashings", "Roof covering"),
    ]],
  ]),
  section("windows-external-doors", "Windows & External Doors", [
    ["Windows and glazing", [
      product("Window system", "Windows and glazing", "Windows"),
      specification("Window frame material", "Windows and glazing"),
      specification("Window colour", "Windows and glazing"),
      specification("Glazing specification", "Windows and glazing"),
      specification("Flyscreens", "Windows and glazing"),
      specification("Security screens", "Windows and glazing"),
      product("Sliding external doors", "Windows and glazing", "Windows"),
    ]],
    ["Entry doors and hardware", [
      product("Hinged external doors", "Entry doors and hardware", "Entry Door"),
      product("Front entry door", "Entry doors and hardware", "Entry Door"),
      product("Entry door hardware", "Entry doors and hardware", "External Door Hardware"),
      specification("External door locks", "Entry doors and hardware"),
      product("Garage door", "Entry doors and hardware", "Garage Doors"),
    ]],
  ]),
  section("internal-doors", "Internal Doors", [
    ["Door leaves and installation", [
      product("Internal door", "Door leaves and installation", "Internal Doors"),
      specification("Door design and profile", "Door leaves and installation"),
      specification("Door material", "Door leaves and installation"),
      specification("Door height", "Door leaves and installation"),
      specification("Hinged doors", "Door leaves and installation"),
      specification("Cavity sliding doors", "Door leaves and installation"),
      specification("Internal door jambs", "Door leaves and installation"),
      specification("Hinges", "Door leaves and installation"),
      specification("Door stops", "Door leaves and installation"),
    ]],
  ]),
  section("internal-door-hardware", "Internal Door Hardware", [
    ["Handles and locks", [
      product("Passage handles", "Handles and locks", "Internal Door Hardware", { namePattern: /passage/i }),
      product("Privacy handles", "Handles and locks", "Internal Door Hardware", { namePattern: /privacy/i }),
      product("Entrance sets", "Handles and locks", "Internal Door Hardware", { namePattern: /entrance|entry/i }),
      product("Cavity door hardware", "Handles and locks", "Cavity Sliding Door Cages"),
      specification("Door locks", "Handles and locks"),
      specification("Hardware finish", "Handles and locks"),
    ]],
  ]),
  section("storage-joinery", "Storage & Joinery", [
    ["Robes and cupboards", [
      product("Wardrobe system", "Robes and cupboards", "Wardrobe Systems"),
      specification("Walk-in robe shelving", "Robes and cupboards"),
      specification("Linen cupboard shelving", "Robes and cupboards"),
      specification("General storage fitout", "Robes and cupboards"),
    ]],
  ]),
  section("internal-linings-finishes", "Internal Linings & Finishes", [
    ["Linings and trim", [
      specification("Plasterboard", "Linings and trim"),
      specification("Wet-area plasterboard", "Linings and trim"),
      specification("Cornices", "Linings and trim"),
      product("Skirting boards", "Linings and trim", "Skirting"),
      product("Architraves", "Linings and trim", "Skirting"),
      specification("Internal insulation", "Linings and trim"),
      specification("Ceiling finishes", "Linings and trim"),
    ]],
    ["Paint", [
      product("Wall paint", "Paint", "Painting"),
      product("Ceiling paint", "Paint", "Painting"),
      specification("Feature paint finishes", "Paint"),
    ]],
  ]),
  section("kitchen-cabinetry", "Kitchen Cabinetry", [
    ["Cabinet construction", [
      product("Cabinet carcass", "Cabinet construction", "Cabinetry"),
      specification("Cabinet door material", "Cabinet construction"),
      product("Cabinet door finish", "Cabinet construction", "Cabinet Finishes"),
      specification("Cabinet door profile", "Cabinet construction"),
      specification("Drawer fronts", "Cabinet construction"),
      specification("Soft-close hinges", "Cabinet construction"),
      specification("Drawer runners", "Cabinet construction"),
      product("Cabinet handles", "Cabinet construction", "Cabinet Handles"),
      specification("Cabinet hardware finish", "Cabinet construction"),
      specification("Kickboards", "Cabinet construction"),
      specification("Overhead cabinets", "Cabinet construction"),
      specification("Pantry cabinetry", "Cabinet construction"),
      specification("Butler's pantry cabinetry", "Cabinet construction"),
    ]],
  ]),
  section("kitchen-benchtops", "Kitchen Benchtops", [
    ["Benchtop and splashback", [
      specification("Benchtop material", "Benchtop and splashback"),
      product("Benchtop brand and range", "Benchtop and splashback", "Benchtops"),
      specification("Benchtop colour", "Benchtop and splashback"),
      specification("Benchtop thickness", "Benchtop and splashback"),
      specification("Edge profile", "Benchtop and splashback"),
      specification("Waterfall ends", "Benchtop and splashback"),
      product("Splashback material", "Benchtop and splashback", "Splashback"),
    ]],
  ]),
  section("kitchen-appliances", "Kitchen Appliances", [
    ["Appliances", [
      product("Oven", "Appliances", "Ovens", { widthMm: 900 }),
      product("Cooktop", "Appliances", "Cooktops", { widthMm: 900 }),
      product("Rangehood", "Appliances", "Rangehoods", { widthsMm: [700, 900] }),
      product("Dishwasher", "Appliances", "Dishwashers"),
      product("Microwave", "Appliances", "Microwaves"),
      specification("Other included appliances", "Appliances"),
    ]],
  ]),
  section("kitchen-plumbing", "Kitchen Plumbing", [
    ["Sink and tapware", [
      product("Kitchen sink", "Sink and tapware", "Kitchen Sinks"),
      product("Kitchen mixer tap", "Sink and tapware", "Kitchen Mixers"),
      product("Filtered water tap", "Sink and tapware", "Filtered Water Taps"),
      specification("Sink accessories", "Sink and tapware"),
    ]],
  ]),
  section("bathrooms-ensuites", "Bathrooms & Ensuites", [
    ["Vanities and sanitaryware", [
      product("Vanity cabinetry", "Vanities and sanitaryware", "Cabinetry"),
      product("Vanity benchtop", "Vanities and sanitaryware", "Benchtops"),
      product("Vanity basin", "Vanities and sanitaryware", "Basins", { productType: /\bbasin\b/i, excludedProductType: /bottle trap|waste/i }),
      product("Basin mixer", "Vanities and sanitaryware", "Basin Mixers", { namePattern: /\bbasin mixer\b/i }),
      product("Bath", "Vanities and sanitaryware", "Baths"),
      product("Bath mixer", "Vanities and sanitaryware", "Bathroom Tapware", { namePattern: /bath.*mixer|mixer.*bath/i }),
      product("Toilet suite", "Vanities and sanitaryware", "Toilets", { productType: /toilet suite|close.coupled|wall.faced|back.to.wall|\bpan\b/i, excludedProductType: /flush plate|button|seat only|cistern only/i }),
    ]],
    ["Showers and accessories", [
      product("Shower mixer", "Showers and accessories", "Shower Mixers", { namePattern: /(?:shower|bath\/shower).*mixer|mixer.*(?:shower|bath\/shower)/i }),
      product("Showerhead", "Showers and accessories", "Showerheads", { productType: /shower.*head|twin shower|rail shower|shower.*outlet/i }),
      product("Shower rail", "Showers and accessories", "Showerheads", { namePattern: /rail|twin shower/i }),
      product("Shower screen", "Showers and accessories", "Shower Screen"),
      product("Toilet roll holder", "Showers and accessories", "Bathroom Accessories", { namePattern: /toilet.*roll/i }),
      product("Towel rails", "Showers and accessories", "Bathroom Accessories", { namePattern: /towel.*rail/i }),
      product("Mirrors", "Showers and accessories", "Mirror"),
      product("Bathroom accessories", "Showers and accessories", "Bathroom Accessories"),
      product("Bathroom exhaust fan", "Showers and accessories", "Exhaust Fans", { namePattern: /exhaust/i }),
    ]],
  ]),
  section("bathroom-tiling", "Bathroom Tiling", [
    ["Tile products", [
      product("Bathroom floor tiles", "Tile products", "Floor Tiles", { productType: /\bfloor\b/i }),
      product("Bathroom wall tiles", "Tile products", "Wall Tiles", { productType: /\bwall\b/i }),
      product("Shower wall tiles", "Tile products", "Wall Tiles", { productType: /\bwall\b/i }),
      product("Shower floor tiles", "Tile products", "Floor Tiles", { productType: /\bfloor\b/i }),
      product("Feature tiles", "Tile products", "Wall Tiles"),
    ]],
    ["Tile installation", [
      specification("Tile dimensions", "Tile installation"),
      specification("Tile finish", "Tile installation"),
      specification("Tile layout", "Tile installation"),
      specification("Grout colour", "Tile installation"),
      specification("Tile trim", "Tile installation"),
      specification("Waterproofing specification", "Tile installation"),
      specification("Tiling height", "Tile installation"),
    ]],
  ]),
  section("laundry", "Laundry", [
    ["Cabinetry, fixtures and tiling", [
      product("Laundry cabinetry", "Cabinetry, fixtures and tiling", "Cabinetry"),
      product("Laundry benchtop", "Cabinetry, fixtures and tiling", "Benchtops"),
      product("Laundry trough", "Cabinetry, fixtures and tiling", "Laundry Tubs"),
      product("Laundry mixer", "Cabinetry, fixtures and tiling", "Laundry Tapware"),
      product("Laundry splashback", "Cabinetry, fixtures and tiling", "Splashback"),
      product("Laundry floor tiles", "Cabinetry, fixtures and tiling", "Floor Tiles", { productType: /\bfloor\b/i }),
      product("Laundry wall tiles", "Cabinetry, fixtures and tiling", "Wall Tiles", { productType: /\bwall\b/i }),
      specification("Laundry accessories", "Cabinetry, fixtures and tiling"),
    ]],
  ]),
  section("floor-coverings", "Floor Coverings", [
    ["Soft and hard flooring", [
      product("Carpet", "Soft and hard flooring", "Carpet Flooring", { productType: /carpet/i }),
      specification("Carpet underlay", "Soft and hard flooring"),
      product("Hybrid flooring", "Soft and hard flooring", "Hard Flooring", { productType: /hybrid/i }),
      product("Vinyl flooring", "Soft and hard flooring", "Hard Flooring", { productType: /vinyl/i }),
      product("Laminate flooring", "Soft and hard flooring", "Hard Flooring", { productType: /laminate/i }),
      product("Engineered timber flooring", "Soft and hard flooring", "Hard Flooring", { productType: /engineered|timber/i }),
      product("Solid timber flooring", "Soft and hard flooring", "Hard Flooring", { productType: /solid timber|timber/i }),
      product("Floor tiles", "Soft and hard flooring", "Floor Tiles", { productType: /\bfloor\b/i }),
      specification("Flooring trims", "Soft and hard flooring"),
      specification("Stair floor finishes", "Soft and hard flooring"),
    ]],
  ]),
  section("stairs-balustrades", "Stairs & Balustrades", [
    ["Stairs", [
      specification("Stair construction", "Stairs"),
      specification("Stair tread material", "Stairs"),
      specification("Stair riser finish", "Stairs"),
      specification("Stair nosing", "Stairs"),
      product("Handrails", "Stairs", "Balustrades"),
    ]],
    ["Balustrades", [
      product("Balustrade system", "Balustrades", "Balustrades"),
      specification("Glass balustrades", "Balustrades"),
      specification("Metal balustrades", "Balustrades"),
      specification("Timber balustrades", "Balustrades"),
      specification("Balustrade finishes", "Balustrades"),
    ]],
  ]),
  section("electrical-lighting", "Electrical & Lighting", [
    ["Electrical fixtures", [
      // Light fittings mention "colour switching", "smoke glass" or "power"; only real devices may match.
      product("Power points", "Electrical fixtures", "Electrical Fixtures", { namePattern: /power ?points?|\bgpo\b|power outlet|socket outlet|double socket|usb outlet/i, excludedProductType: LIGHT_FITTING }),
      product("Light switches", "Electrical fixtures", "Electrical Fixtures", { namePattern: /light switch|wall switch|switch plate|switch mech|dimmer switch/i, excludedProductType: LIGHT_FITTING }),
      product("LED downlights", "Electrical fixtures", "Lighting", { productType: /downlight/i, excludedProductType: /frame only|trim only|\bdriver\b/i }),
      product("Pendant lights", "Electrical fixtures", "Lighting", { productType: /pendant/i }),
      product("External lights", "Electrical fixtures", "External Lighting", { excludedProductType: /\bdriver\b|transformer|\bcable\b|connector|power supply|frame only/i }),
      product("Ceiling fans", "Electrical fixtures", "Ceiling Fans"),
      product("Exhaust fans", "Electrical fixtures", "Exhaust Fans", { namePattern: /exhaust/i }),
      product("Smoke alarms", "Electrical fixtures", "Smoke Alarms", { namePattern: /smoke alarm|smoke detector|smoke and heat alarm/i, excludedProductType: LIGHT_FITTING }),
      specification("Data points", "Electrical fixtures"),
      specification("Television points", "Electrical fixtures"),
      specification("Switchboard", "Electrical fixtures"),
      specification("Safety switches", "Electrical fixtures"),
      specification("Doorbell", "Electrical fixtures"),
      product("Garage door motor", "Electrical fixtures", "Garage Doors"),
    ]],
  ]),
  section("heating-cooling-hot-water", "Heating, Cooling & Hot Water", [
    ["Mechanical services", [
      product("Split-system air conditioning", "Mechanical services", "Air Conditioning", { namePattern: /split/i }),
      product("Ducted air conditioning", "Mechanical services", "Air Conditioning", { namePattern: /ducted/i }),
      product("Heating systems", "Mechanical services", "Heating"),
      specification("Ventilation", "Mechanical services"),
      specification("Hot water system type", "Mechanical services"),
      product("Hot water system", "Mechanical services", "Hot Water Systems", { excludedProductType: /pool|tank only|collector only/i }),
    ]],
  ]),
  section("external-works", "External Works", [
    ["Hardscape and landscape", [
      product("Driveway finish", "Hardscape and landscape", "Driveway Finishes"),
      specification("Paths", "Hardscape and landscape"),
      specification("Patios", "Hardscape and landscape"),
      specification("Alfresco finishes", "Hardscape and landscape"),
      specification("Balcony finishes", "Hardscape and landscape"),
      product("External tiling", "Hardscape and landscape", "Floor Tiles"),
      product("Decking", "Hardscape and landscape", "Decking"),
      specification("Fencing", "Hardscape and landscape"),
      specification("Gates", "Hardscape and landscape"),
      product("Retaining walls", "Hardscape and landscape", "Retaining Walls"),
      product("Landscaping allowance", "Hardscape and landscape", "Landscaping"),
      specification("Stormwater connections", "Hardscape and landscape"),
    ]],
  ]),
]);

export const RESIDENTIAL_INCLUSION_ITEMS = Object.freeze(
  RESIDENTIAL_INCLUSION_STRUCTURE.flatMap((entry) => entry.groups.flatMap((group) => group.items)),
);

export const PRODUCT_INCLUSION_ITEMS = Object.freeze(
  RESIDENTIAL_INCLUSION_ITEMS.filter((item) => item.productRequired),
);
