import PlaceholderPage from './PlaceholderPage';

/** The sections of DMS+ that exist in the sidebar but are not part of this demo. */
export default function NotInDemoPage({ title }: { title: string }) {
  return (
    <PlaceholderPage title={title}>
      <section className="mt-6 flex max-w-xl flex-col gap-1 rounded-card border border-line bg-field-disabled p-6">
        <h2 className="text-link-s text-label">Not part of this demo</h2>
        <p className="text-body-m text-subtle">
          {title} is not included in this prototype. Use the sidebar to go to another section.
        </p>
      </section>
    </PlaceholderPage>
  );
}
