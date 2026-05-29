'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Interpolated live world-population estimate. Base figure is anchored to a
// known timestamp and advanced by the net growth rate; "other mammals" is a
// rough static headcount (wild + domesticated non-human mammals).
const WORLD_POPULATION_BASE = 8_293_639_584;
const WORLD_POPULATION_BASE_TS = Date.UTC(2026, 4, 25, 12, 0, 0);
const WORLD_POPULATION_NET_GROWTH_PER_SECOND = 2.2;
const WORLD_POPULATION_UPDATE_MS = 1200;
const OTHER_MAMMALS_ESTIMATE = 137_000_000_000;

const FlipDigit = ({ value, previous }: { value: string; previous: string }) => {
  const changed = value !== previous;

  return (
    <span className="live-population__flap" data-changed={changed ? 'true' : 'false'}>
      <span className="live-population__flap-static live-population__flap-static--top">{value}</span>
      <span className="live-population__flap-static live-population__flap-static--bottom">{value}</span>
      <AnimatePresence initial={false}>
        {changed && (
          <motion.span
            key={`top-${previous}-${value}`}
            className="live-population__flap-blade live-population__flap-blade--top"
            initial={{ rotateX: 0, filter: 'brightness(1.18)' }}
            animate={{ rotateX: [0, -64, -104], filter: ['brightness(1.24)', 'brightness(0.75)', 'brightness(0.36)'] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.28, times: [0, 0.66, 1], ease: [0.74, 0, 0.84, 0] }}
          >
            {previous}
          </motion.span>
        )}
      </AnimatePresence>
      <AnimatePresence initial={false}>
        {changed && (
          <motion.span
            key={`bottom-${previous}-${value}`}
            className="live-population__flap-blade live-population__flap-blade--bottom"
            initial={{ rotateX: 96, filter: 'brightness(0.42)' }}
            animate={{ rotateX: [96, -9, 0], filter: ['brightness(0.46)', 'brightness(1.32)', 'brightness(1.08)'] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.44, delay: 0.14, times: [0, 0.72, 1], ease: [0.16, 1, 0.3, 1] }}
          >
            {value}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
};

const SplitFlapNumber = ({ value, previous }: { value: string; previous: string }) => (
  <span className="live-population__odometer" aria-label={value}>
    {value.split('').map((char, index) => (
      char === ',' ? (
        <span className="live-population__separator" key={`${char}-${index}`}>,</span>
      ) : (
        <FlipDigit value={char} previous={previous[index] || char} key={index} />
      )
    ))}
  </span>
);

export default function LivePopulationClock() {
  const estimatePopulation = useCallback(() => {
    const elapsedSeconds = (Date.now() - WORLD_POPULATION_BASE_TS) / 1000;
    return Math.round(WORLD_POPULATION_BASE + elapsedSeconds * WORLD_POPULATION_NET_GROWTH_PER_SECOND);
  }, []);
  // Initialise to the deterministic base so SSR and the first client render
  // match (avoids a hydration mismatch); jump to the live estimate after mount.
  const [population, setPopulation] = useState(WORLD_POPULATION_BASE);
  const previousPopulation = useRef(population);

  useEffect(() => {
    setPopulation(estimatePopulation());
    const iv = setInterval(() => setPopulation(estimatePopulation()), WORLD_POPULATION_UPDATE_MS);
    return () => clearInterval(iv);
  }, [estimatePopulation]);

  useEffect(() => {
    previousPopulation.current = population;
  }, [population]);

  const populationChars = population.toLocaleString('en-GB').split('');
  const previousChars = previousPopulation.current.toLocaleString('en-GB').split('');
  const populationValue = populationChars.join('');
  const previousPopulationValue = previousChars.join('');
  const otherMammalsValue = OTHER_MAMMALS_ESTIMATE.toLocaleString('en-GB');

  return (
    <span
      className="live-population hidden md:inline-flex pointer-events-auto"
      title="Humans are an interpolated live estimate. Other mammals is a rough headcount estimate: wild mammals plus domesticated non-human mammals."
    >
      <span className="live-population__rows">
        <span className="live-population__row">
          <span className="live-population__pulse" />
          <span className="live-population__label">HUMANS</span>
          <SplitFlapNumber value={populationValue} previous={previousPopulationValue} />
        </span>
        <span className="live-population__row">
          <span className="live-population__pulse live-population__pulse--muted" />
          <span className="live-population__label">OTHER MAMMALS</span>
          <SplitFlapNumber value={otherMammalsValue} previous={otherMammalsValue} />
        </span>
      </span>
    </span>
  );
}
