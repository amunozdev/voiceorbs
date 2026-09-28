import { ORB_PROPS } from '@/registry/registry';

export const PropsTable = () => (
  <div className="rounded-2xl border border-border bg-panel/60">
    <dl className="divide-y divide-border sm:hidden">
      {ORB_PROPS.map((prop) => (
        <div key={prop.name} className="flex flex-col gap-1.5 px-4 py-3.5">
          <dt className="font-mono text-xs font-medium text-accent-foreground">{prop.name}</dt>
          <dd className="break-words font-mono text-xs text-muted">{prop.type}</dd>
          <dd className="text-xs text-muted">
            Default: <span className="font-mono text-foreground">{prop.default}</span>
          </dd>
          <dd className="text-xs leading-relaxed text-muted">{prop.description}</dd>
        </div>
      ))}
    </dl>
    <div className="hidden overflow-x-auto sm:block">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-border">
            <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted">Prop</th>
            <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted">Type</th>
            <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted">Default</th>
            <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted">Description</th>
          </tr>
        </thead>
        <tbody>
          {ORB_PROPS.map((prop) => (
            <tr key={prop.name} className="border-b border-border align-top last:border-b-0">
              <td className="whitespace-nowrap px-4 py-3 font-mono text-xs font-medium text-accent-foreground">
                {prop.name}
              </td>
              <td className="min-w-40 px-4 py-3 font-mono text-xs text-muted">{prop.type}</td>
              <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-muted">{prop.default}</td>
              <td className="min-w-56 px-4 py-3 text-xs leading-relaxed text-muted">{prop.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);
