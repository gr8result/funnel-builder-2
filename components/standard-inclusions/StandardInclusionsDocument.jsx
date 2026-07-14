import Page01Cover from "./pages/Page01Cover";
import Page02PremierIntroduction from "./pages/Page02PremierIntroduction";
import Page03CreatingHomes from "./pages/Page03CreatingHomes";
import Page04DesignedForLiving from "./pages/Page04DesignedForLiving";
import Page05ConstructionInclusions from "./pages/Page05ConstructionInclusions";
import Page06SelectionsProcess from "./pages/Page06SelectionsProcess";
import styles from "./standardInclusions.module.css";
import { orderedEnabledPages, standardInclusionsData } from "./standardInclusionsData";

const pageComponents = {
  Page01Cover,
  Page02PremierIntroduction,
  Page03CreatingHomes,
  Page04DesignedForLiving,
  Page05ConstructionInclusions,
  Page06SelectionsProcess,
};

const pageDataKeys = {
  "page01-cover": "page01Cover",
  "page02-premier-introduction": "page02PremierIntroduction",
  "page03-creating-homes": "page03CreatingHomes",
  "page04-designed-for-living": "page04DesignedForLiving",
  "page05-construction-inclusions": "page05ConstructionInclusions",
  "page06-selections-process": "page06SelectionsProcess",
};

export const standardInclusionsPages = [
  Page01Cover,
  Page02PremierIntroduction,
  Page03CreatingHomes,
  Page04DesignedForLiving,
  Page05ConstructionInclusions,
  Page06SelectionsProcess,
];

export default function StandardInclusionsDocument({ data = standardInclusionsData, builder = {}, pages = null, onImageDoubleClick = null }) {
  const pageSettings = orderedEnabledPages(pages || data.pages);
  const builderData = { ...standardInclusionsData.builder, ...(data.builder || {}), ...builder };

  return (
    <div className={styles.document}>
      {pageSettings.map((pageSetting, index) => {
        const PageComponent = pageComponents[pageSetting.component];
        if (!PageComponent) return null;
        const pageData = data[pageDataKeys[pageSetting.id]] || {};
        return (
          <PageComponent
            key={pageSetting.id}
            page={pageData}
            builder={builderData}
            onImageDoubleClick={onImageDoubleClick}
            pageNumber={index + 1}
          />
        );
      })}
    </div>
  );
}
