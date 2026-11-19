import type { Exercise } from './types';

type Def = Omit<Exercise, 'createdAt'>;

/** Default exercise library, added on first run. Fully editable in the app. */
export const DEFAULT_EXERCISES: Def[] = [
  { id: 'ex-pullup', name: 'Pull-ups', category: 'strength', metrics: ['reps', 'addedKg', 'restSec'] },
  { id: 'ex-pushup', name: 'Push-ups', category: 'antagonist', metrics: ['reps', 'restSec'] },
  { id: 'ex-dip', name: 'Dips', category: 'antagonist', metrics: ['reps', 'addedKg', 'restSec'] },
  { id: 'ex-hang-20', name: 'Max hang (20mm edge)', category: 'fingerboard', metrics: ['hangSec', 'addedKg', 'restSec'] },
  { id: 'ex-repeaters', name: 'Repeaters 7:3', category: 'fingerboard', metrics: ['reps', 'hangSec', 'addedKg', 'restSec'] },
  { id: 'ex-lockoff', name: 'Lock-offs', category: 'strength', metrics: ['reps', 'hangSec', 'addedKg'] },
  { id: 'ex-frontlever', name: 'Front lever progression', category: 'strength', metrics: ['reps', 'hangSec'] },
  { id: 'ex-leg-raise', name: 'Hanging leg raises', category: 'strength', metrics: ['reps'] },
  { id: 'ex-plank', name: 'Plank', category: 'strength', metrics: ['hangSec'] },
  { id: 'ex-campus', name: 'Campus ladders', category: 'power', metrics: ['reps', 'restSec'] },
  { id: 'ex-limit-boulder', name: 'Limit bouldering', category: 'power', metrics: ['reps', 'restSec'] },
  { id: 'ex-4x4', name: '4×4s', category: 'endurance', metrics: ['reps', 'restSec'] },
  { id: 'ex-arc', name: 'ARC traversing (min)', category: 'endurance', metrics: ['reps'] },
  { id: 'ex-deadlift', name: 'Deadlift', category: 'strength', metrics: ['reps', 'weightKg', 'restSec'] },
  { id: 'ex-shoulder-press', name: 'Shoulder press', category: 'antagonist', metrics: ['reps', 'weightKg'] },
  { id: 'ex-wrist', name: 'Reverse wrist curls', category: 'antagonist', metrics: ['reps', 'weightKg'] },
  { id: 'ex-hip-mob', name: 'Hip mobility flow', category: 'mobility', metrics: ['hangSec'] },
  { id: 'ex-yoga', name: 'Yoga flow (min)', category: 'yoga', metrics: ['reps'] },
];
