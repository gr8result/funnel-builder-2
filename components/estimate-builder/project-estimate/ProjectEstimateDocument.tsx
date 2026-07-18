import { PROJECT_ESTIMATE_PAGES, projectEstimatePageDefinitionFor } from "./ProjectEstimateRegistry";

export function ProjectEstimateDocument({ pages, renderPage, ...props }: any) {
  const sourcePages = Array.isArray(pages) && pages.length ? pages : PROJECT_ESTIMATE_PAGES.map((definition) => ({ id: definition.id, page_type: definition.id }));
  return (
    <>
      {sourcePages.map((page: any) => {
        const definition = projectEstimatePageDefinitionFor(page.page_type || page.id);
        if (!definition) return null;
        if (renderPage) return renderPage(page, definition);
        const Component = definition.Component;
        return <Component key={page.id || definition.id} {...props} page={page} content={definition.defaultContent} />;
      })}
    </>
  );
}

export default ProjectEstimateDocument;
