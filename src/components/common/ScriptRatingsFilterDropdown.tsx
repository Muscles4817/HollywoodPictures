import {
  useEffect,
  useRef,
  useState,
} from 'react';
import './ScriptRatingsFilterDropdown.css';

export type WritingRatingField =
  | 'dialogue'
  | 'characters'
  | 'structure';

export type CreativeRatingField =
  | 'originality'
  | 'complexity';

export type ToneRatingField =
  | 'action'
  | 'comedy'
  | 'romance'
  | 'suspense'
  | 'drama'
  | 'spectacle';

export type ToneBand = 'low' | 'medium' | 'high';

export interface ScriptRatingsFilterValue {
  writingMinimums: Partial<
    Record<WritingRatingField, number>
  >;
  creativeMinimums: Partial<
    Record<CreativeRatingField, number>
  >;
  toneBands: Partial<
    Record<ToneRatingField, ToneBand>
  >;
}

interface ScriptRatingsFilterDropdownProps {
  id: string;
  value: ScriptRatingsFilterValue;
  isOpen: boolean;
  onToggle: (id: string) => void;
  onClose: () => void;
  onChange: (value: ScriptRatingsFilterValue) => void;
}

interface RatingFieldOption<TField extends string> {
  id: TField;
  label: string;
}

const WRITING_FIELDS: RatingFieldOption<WritingRatingField>[] = [
  {
    id: 'dialogue',
    label: 'Dialogue',
  },
  {
    id: 'characters',
    label: 'Characters',
  },
  {
    id: 'structure',
    label: 'Structure',
  },
];

const CREATIVE_FIELDS: RatingFieldOption<CreativeRatingField>[] = [
  {
    id: 'originality',
    label: 'Originality',
  },
  {
    id: 'complexity',
    label: 'Complexity',
  },
];

const TONE_FIELDS: RatingFieldOption<ToneRatingField>[] = [
  {
    id: 'action',
    label: 'Action',
  },
  {
    id: 'comedy',
    label: 'Comedy',
  },
  {
    id: 'romance',
    label: 'Romance',
  },
  {
    id: 'suspense',
    label: 'Suspense',
  },
  {
    id: 'drama',
    label: 'Drama',
  },
  {
    id: 'spectacle',
    label: 'Spectacle',
  },
];

const MINIMUM_RATING_OPTIONS = [2, 3, 4, 5];

const TONE_BAND_OPTIONS: Array<{
  id: ToneBand;
  label: string;
}> = [
  {
    id: 'low',
    label: 'Low',
  },
  {
    id: 'medium',
    label: 'Medium',
  },
  {
    id: 'high',
    label: 'High',
  },
];

export const EMPTY_SCRIPT_RATINGS_FILTER: ScriptRatingsFilterValue = {
  writingMinimums: {},
  creativeMinimums: {},
  toneBands: {},
};

export function ScriptRatingsFilterDropdown({
  id,
  value,
  isOpen,
  onToggle,
  onClose,
  onChange,
}: ScriptRatingsFilterDropdownProps) {
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [openSections, setOpenSections] = useState({
    writing: true,
    creative: true,
    tone: true,
  });

  const writingFilterCount = Object.keys(
    value.writingMinimums,
  ).length;

  const creativeFilterCount = Object.keys(
    value.creativeMinimums,
  ).length;

  const toneFilterCount = Object.keys(
    value.toneBands,
  ).length;

  const activeFilterCount =
    writingFilterCount +
    creativeFilterCount +
    toneFilterCount;

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;

      if (
        target instanceof Node &&
        dropdownRef.current &&
        !dropdownRef.current.contains(target)
      ) {
        onClose();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener(
      'pointerdown',
      handlePointerDown,
    );
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener(
        'pointerdown',
        handlePointerDown,
      );
      document.removeEventListener(
        'keydown',
        handleKeyDown,
      );
    };
  }, [isOpen, onClose]);

  const setWritingMinimum = (
    field: WritingRatingField,
    minimum: number | undefined,
  ) => {
    const writingMinimums = {
      ...value.writingMinimums,
    };

    if (minimum === undefined) {
      delete writingMinimums[field];
    } else {
      writingMinimums[field] = minimum;
    }

    onChange({
      ...value,
      writingMinimums,
    });
  };

  const setCreativeMinimum = (
    field: CreativeRatingField,
    minimum: number | undefined,
  ) => {
    const creativeMinimums = {
      ...value.creativeMinimums,
    };

    if (minimum === undefined) {
      delete creativeMinimums[field];
    } else {
      creativeMinimums[field] = minimum;
    }

    onChange({
      ...value,
      creativeMinimums,
    });
  };

  const setToneBand = (
    field: ToneRatingField,
    band: ToneBand | undefined,
  ) => {
    const toneBands = {
      ...value.toneBands,
    };

    if (band === undefined) {
      delete toneBands[field];
    } else {
      toneBands[field] = band;
    }

    onChange({
      ...value,
      toneBands,
    });
  };

  const clearAll = () => {
    onChange({
      writingMinimums: {},
      creativeMinimums: {},
      toneBands: {},
    });
  };

  const toggleSection = (
    section: keyof typeof openSections,
  ) => {
    setOpenSections((current) => ({
      ...current,
      [section]: !current[section],
    }));
  };

  return (
    <div
      ref={dropdownRef}
      className="script-ratings-filter"
    >
      <button
        type="button"
        className={[
          'script-ratings-filter__trigger',
          isOpen
            ? 'script-ratings-filter__trigger--open'
            : '',
        ]
          .filter(Boolean)
          .join(' ')}
        aria-expanded={isOpen}
        aria-controls={`${id}-ratings-filter-menu`}
        onClick={() => onToggle(id)}
      >
        <span>
          <span className="script-ratings-filter__trigger-label">
            Ratings
          </span>

          <span className="script-ratings-filter__trigger-value">
            {activeFilterCount === 0
              ? 'Any ratings'
              : `${activeFilterCount} active`}
          </span>
        </span>

        <span
          className={[
            'script-ratings-filter__chevron',
            isOpen
              ? 'script-ratings-filter__chevron--open'
              : '',
          ]
            .filter(Boolean)
            .join(' ')}
          aria-hidden="true"
        >
          ▼
        </span>
      </button>

      {isOpen && (
        <div
          id={`${id}-ratings-filter-menu`}
          className="script-ratings-filter__menu"
        >
          <div className="script-ratings-filter__header">
            <div>
              <strong>Script Ratings</strong>

              <div className="script-ratings-filter__description">
                Writing and creative values are minimum ratings.
              </div>
            </div>

            <button
              type="button"
              className="script-ratings-filter__clear"
              disabled={activeFilterCount === 0}
              onClick={clearAll}
            >
              Clear all
            </button>
          </div>

          <RatingSection
            title="Writing"
            activeCount={writingFilterCount}
            isOpen={openSections.writing}
            onToggle={() => toggleSection('writing')}
          >
            {WRITING_FIELDS.map((field) => (
              <MinimumRatingRow
                key={field.id}
                label={field.label}
                value={value.writingMinimums[field.id]}
                onChange={(minimum) =>
                  setWritingMinimum(
                    field.id,
                    minimum,
                  )
                }
              />
            ))}
          </RatingSection>

          <RatingSection
            title="Creative"
            activeCount={creativeFilterCount}
            isOpen={openSections.creative}
            onToggle={() => toggleSection('creative')}
          >
            {CREATIVE_FIELDS.map((field) => (
              <MinimumRatingRow
                key={field.id}
                label={field.label}
                value={value.creativeMinimums[field.id]}
                onChange={(minimum) =>
                  setCreativeMinimum(
                    field.id,
                    minimum,
                  )
                }
              />
            ))}
          </RatingSection>

          <RatingSection
            title="Tone Profile"
            activeCount={toneFilterCount}
            isOpen={openSections.tone}
            onToggle={() => toggleSection('tone')}
          >
            <p className="script-ratings-filter__section-help">
              Tone describes prominence, not quality.
            </p>

            {TONE_FIELDS.map((field) => (
              <ToneBandRow
                key={field.id}
                label={field.label}
                value={value.toneBands[field.id]}
                onChange={(band) =>
                  setToneBand(field.id, band)
                }
              />
            ))}
          </RatingSection>
        </div>
      )}
    </div>
  );
}

interface RatingSectionProps {
  title: string;
  activeCount: number;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function RatingSection({
  title,
  activeCount,
  isOpen,
  onToggle,
  children,
}: RatingSectionProps) {
  return (
    <section className="script-ratings-filter__section">
      <button
        type="button"
        className="script-ratings-filter__section-trigger"
        aria-expanded={isOpen}
        onClick={onToggle}
      >
        <span>
          {title}

          {activeCount > 0 && (
            <span className="script-ratings-filter__active-count">
              {activeCount}
            </span>
          )}
        </span>

        <span
          className={[
            'script-ratings-filter__section-chevron',
            isOpen
              ? 'script-ratings-filter__section-chevron--open'
              : '',
          ]
            .filter(Boolean)
            .join(' ')}
          aria-hidden="true"
        >
          ▼
        </span>
      </button>

      {isOpen && (
        <div className="script-ratings-filter__section-content">
          {children}
        </div>
      )}
    </section>
  );
}

interface MinimumRatingRowProps {
  label: string;
  value?: number;
  onChange: (value: number | undefined) => void;
}

function MinimumRatingRow({
  label,
  value,
  onChange,
}: MinimumRatingRowProps) {
  return (
    <div className="script-ratings-filter__row">
      <span className="script-ratings-filter__field-label">
        {label}
      </span>

      <div className="script-ratings-filter__choices">
        <FilterChoice
          label="Any"
          selected={value === undefined}
          onClick={() => onChange(undefined)}
        />

        {MINIMUM_RATING_OPTIONS.map((minimum) => (
          <FilterChoice
            key={minimum}
            label={`${minimum}★+`}
            selected={value === minimum}
            onClick={() => onChange(minimum)}
          />
        ))}
      </div>
    </div>
  );
}

interface ToneBandRowProps {
  label: string;
  value?: ToneBand;
  onChange: (value: ToneBand | undefined) => void;
}

function ToneBandRow({
  label,
  value,
  onChange,
}: ToneBandRowProps) {
  return (
    <div className="script-ratings-filter__row">
      <span className="script-ratings-filter__field-label">
        {label}
      </span>

      <div className="script-ratings-filter__choices">
        <FilterChoice
          label="Any"
          selected={value === undefined}
          onClick={() => onChange(undefined)}
        />

        {TONE_BAND_OPTIONS.map((band) => (
          <FilterChoice
            key={band.id}
            label={band.label}
            selected={value === band.id}
            onClick={() => onChange(band.id)}
          />
        ))}
      </div>
    </div>
  );
}

interface FilterChoiceProps {
  label: string;
  selected: boolean;
  onClick: () => void;
}

function FilterChoice({
  label,
  selected,
  onClick,
}: FilterChoiceProps) {
  return (
    <button
      type="button"
      className={[
        'script-ratings-filter__choice',
        selected
          ? 'script-ratings-filter__choice--selected'
          : '',
      ]
        .filter(Boolean)
        .join(' ')}
      aria-pressed={selected}
      onClick={onClick}
    >
      {label}
    </button>
  );
}