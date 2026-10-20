/**
 * Renders controlled, editable Remote Pod branch fields with common branch shortcuts.
 */

import { useEffect, useId, useRef, useState } from 'react';

import {
  remoteBranchOptions,
  remoteBranchPreset,
  remoteBranchPresetOptions,
} from './branches';
import styles from './remote-branch-fields.module.css';

interface BranchFieldProps {
  id: string;
  label: string;
  value: string;
  localBranch: string;
  different: boolean;
  onChange: (value: string) => void;
}

interface RemoteBranchFieldsProps {
  pathBranch: string;
  testsBranch: string;
  localPathBranch: string;
  localTestsBranch: string;
  pathDifferent: boolean;
  testsDifferent: boolean;
  onPathBranchChange: (value: string) => void;
  onTestsBranchChange: (value: string) => void;
  onUseCurrentLocal: () => void;
  onUseDevelop: () => void;
}

function BranchField({ id, label, value, localBranch, different, onChange }: BranchFieldProps) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const root = useRef<HTMLDivElement>(null);
  const options = remoteBranchOptions(localBranch);

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  return (
    <div className={styles.field} ref={root}>
      <label htmlFor={id}>{label}</label>
      <div className={styles.combo}>
        <input
          id={id}
          className={different ? styles.different : undefined}
          value={value}
          aria-invalid={different || undefined}
          autoComplete="off"
          onChange={(event) => onChange(event.target.value)}
        />
        <button
          className={styles.toggle}
          type="button"
          aria-label={`Show ${label.toLowerCase()} suggestions`}
          aria-expanded={open}
          aria-controls={menuId}
          aria-haspopup="listbox"
          onClick={() => setOpen((current) => !current)}
        >
          ▾
        </button>
        {open && (
          <div id={menuId} className={styles.menu} role="listbox" aria-label={`${label} suggestions`}>
            {options.map((option) => (
              <button
                className={styles.option}
                type="button"
                role="option"
                aria-selected={value === option.value}
                title={option.value}
                key={option.value}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
              >
                <span>{option.value}</span>
                {option.currentLocal && <small>Current local</small>}
              </button>
            ))}
          </div>
        )}
      </div>
      {localBranch.trim() !== 'develop' && (
        <small className={styles.localBranch} title={localBranch}>
          Current local: <b>{localBranch}</b>
        </small>
      )}
    </div>
  );
}

export function RemoteBranchFields({
  pathBranch,
  testsBranch,
  localPathBranch,
  localTestsBranch,
  pathDifferent,
  testsDifferent,
  onPathBranchChange,
  onTestsBranchChange,
  onUseCurrentLocal,
  onUseDevelop,
}: RemoteBranchFieldsProps) {
  const preset = remoteBranchPreset(
    { pathBranch, testsBranch },
    { path: localPathBranch, tests: localTestsBranch },
  );
  const presetOptions = remoteBranchPresetOptions({
    path: localPathBranch,
    tests: localTestsBranch,
  });
  return (
    <div className={styles.fields}>
      <div className={styles.actions}>
        <span>BRANCH PRESET</span>
        <div role="group" aria-label="Remote Pod branch preset">
          {presetOptions.map((option) => (
            <button
              type="button"
              onClick={option.preset === 'local' ? onUseCurrentLocal : onUseDevelop}
              aria-pressed={preset === option.preset}
              title={option.title}
              key={option.preset}
            >
              {option.label}
            </button>
          ))}
        </div>
        {preset === 'custom' && <small className={styles.custom}>Custom values</small>}
      </div>
      <BranchField
        id="remote-path-branch"
        label="PATH BRANCH"
        value={pathBranch}
        localBranch={localPathBranch}
        different={pathDifferent}
        onChange={onPathBranchChange}
      />
      <BranchField
        id="remote-tests-branch"
        label="TEST BRANCH"
        value={testsBranch}
        localBranch={localTestsBranch}
        different={testsDifferent}
        onChange={onTestsBranchChange}
      />
    </div>
  );
}