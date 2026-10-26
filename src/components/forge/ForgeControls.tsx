import { useState } from 'react';
import {
  Bot,
  Briefcase,
  Code2,
  FlaskConical,
  GraduationCap,
  Image as ImageIcon,
  PenLine,
  Settings2,
  Wand2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  LENGTH_LABEL,
  PERSONAS,
  STRUCTURE_LABEL,
  type ForgeOptions,
  type PersonaId,
} from '@/lib/promptEngine';
import { cn } from '@/lib/utils';

const ICONS: Record<string, LucideIcon> = {
  Wand2,
  Code2,
  Bot,
  PenLine,
  FlaskConical,
  Image: ImageIcon,
  Briefcase,
  GraduationCap,
};

interface ForgeControlsProps {
  options: ForgeOptions;
  onChange: (patch: Partial<ForgeOptions>) => void;
  disabled?: boolean;
}

export function ForgeControls({ options, onChange, disabled }: ForgeControlsProps) {
  const [open, setOpen] = useState(false);

  const activePersona = PERSONAS.find((p) => p.id === options.persona) ?? PERSONAS[0];

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="rounded-2xl border bg-card/60">
        <div className="flex flex-wrap items-center gap-2 px-3 py-2.5">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
              <Settings2 className="size-3.5" />
              Forge controls
              <span className="hidden text-[11px] text-muted-foreground/70 sm:inline">
                · {activePersona.label}
              </span>
            </Button>
          </CollapsibleTrigger>

          <div className="ml-auto flex items-center gap-2">
            <Select
              value={options.structure}
              onValueChange={(v) => onChange({ structure: v as ForgeOptions['structure'] })}
              disabled={disabled}
            >
              <SelectTrigger size="sm" className="h-8 w-[8.5rem] text-xs" aria-label="Output format">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(STRUCTURE_LABEL) as Array<ForgeOptions['structure']>).map((key) => (
                  <SelectItem key={key} value={key} className="text-xs">
                    {STRUCTURE_LABEL[key]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={options.length}
              onValueChange={(v) => onChange({ length: v as ForgeOptions['length'] })}
              disabled={disabled}
            >
              <SelectTrigger size="sm" className="h-8 w-[7.5rem] text-xs" aria-label="Prompt length">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(LENGTH_LABEL) as Array<ForgeOptions['length']>).map((key) => (
                  <SelectItem key={key} value={key} className="text-xs">
                    {LENGTH_LABEL[key]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <CollapsibleContent>
          <div className="space-y-5 border-t px-3 py-4">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Target expertise</Label>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Persona">
                {PERSONAS.map((persona) => {
                  const Icon = ICONS[persona.icon] ?? Wand2;
                  const active = options.persona === persona.id;
                  return (
                    <button
                      key={persona.id}
                      type="button"
                      disabled={disabled}
                      onClick={() => onChange({ persona: persona.id as PersonaId })}
                      title={persona.hint}
                      aria-pressed={active}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:opacity-50',
                        active
                          ? 'border-primary/40 bg-primary/10 text-primary'
                          : 'bg-background text-muted-foreground hover:border-border hover:text-foreground',
                      )}
                    >
                      <Icon className="size-3.5" />
                      {persona.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex items-start justify-between gap-3 rounded-xl border bg-background/60 p-3">
                <span className="space-y-0.5">
                  <span className="block text-xs font-medium">Fill gaps with assumptions</span>
                  <span className="block text-[11px] text-muted-foreground">
                    Marks sensible defaults as [assumption: …]
                  </span>
                </span>
                <Switch
                  checked={options.assumptionMode}
                  onCheckedChange={(v) => onChange({ assumptionMode: v })}
                  disabled={disabled}
                  aria-label="Fill gaps with assumptions"
                />
              </label>

              <label className="flex items-start justify-between gap-3 rounded-xl border bg-background/60 p-3">
                <span className="space-y-0.5">
                  <span className="block text-xs font-medium">Suggest open questions</span>
                  <span className="block text-[11px] text-muted-foreground">
                    Appends up to 3 sharp follow-ups
                  </span>
                </span>
                <Switch
                  checked={options.askQuestions}
                  onCheckedChange={(v) => onChange({ askQuestions: v })}
                  disabled={disabled}
                  aria-label="Suggest open questions"
                />
              </label>
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
