
import fs from 'node:fs';
import { Dance } from '../model/generated/Dance.js';
import { DanceDiagram } from '../model/generated/DanceDiagram.js';
import { DanceMusic } from '../model/generated/DanceMusic.js';
import { DancePosition } from '../model/generated/DancePosition.js';
import { DanceStructure } from '../model/generated/DanceStructure.js';
import { PositionType } from '../model/generated/PositionType.js';

const DANCES = [
  new Dance({
    name: "La polca",
    structure: new DanceStructure({ rows: 2, columns: 4 }),
    diagram: new DanceDiagram({blockName: "Grup", backgroundColor: {"BAIX":"#FFF2CC", "DALT":"#92D050"}, textColor: {"BAIX":"#000000", "DALT":"#000000"}}),
    minGroups: 1,
    positions: [
      new DancePosition({ order: 1, tag: "5", positionType: new PositionType({ label: "DALT" }), specifications: "Cantó equerre/cara plaça" }),
      new DancePosition({ order: 2, tag: "6", positionType: new PositionType({ label: "BAIX" }), specifications: "Mig equerre/cara plaça" }),
      new DancePosition({ order: 3, tag: "7", positionType: new PositionType({ label: "DALT" }), specifications: "Mig dret/cara plaça" }),
      new DancePosition({ order: 4, tag: "8", positionType: new PositionType({ label: "BAIX" }), specifications: "Cantó dret/cara plaça" }),
      new DancePosition({ order: 5, tag: "4", positionType: new PositionType({ label: "BAIX" }), specifications: "Cantó equerre/esquena plaça" }),
      new DancePosition({ order: 6, tag: "3", positionType: new PositionType({ label: "DALT" }), specifications: "Mig esquerre/esquena plaça" }),
      new DancePosition({ order: 7, tag: "2", positionType: new PositionType({ label: "BAIX" }), specifications: "Mig dret/esquena plaça" }),
      new DancePosition({ order: 8, tag: "1", positionType: new PositionType({ label: "DALT" }), specifications: "Cantó dret/esquena plaça" }),
    ],
    audios: [
      
    ],
  }),
  new Dance({
    name: "Ara i sempre",
    structure: new DanceStructure({ rows: 2, columns: 1 }),
    diagram: new DanceDiagram({blockName: "Parella", backgroundColor: {"ANTIHORARI":"#FFF2CC", "HORARI":"#92D050"}, textColor: {"ANTIHORARI":"#000000", "HORARI":"#000000"}}),
    minGroups: 3,
    positions: [
      new DancePosition({ order: 1, tag: "1", positionType: new PositionType({ label: "ANTIHORARI" }), specifications: "Antihorari" }),
      new DancePosition({ order: 2, tag: "2", positionType: new PositionType({ label: "HORARI" }), specifications: "Horari" }),
    ]
  }),
  new Dance({
    name: "La boja de 8",
    structure: new DanceStructure({ rows: 2, columns: 4 }),
    diagram: new DanceDiagram({blockName: "Grup", backgroundColor: {"CARLOTETA":"#FFF2CC", "CORRER":"#92D050"}, textColor: {"CARLOTETA":"#000000", "CORRER":"#000000"}}),
    minGroups: 1,
    positions: [
      new DancePosition({ order: 1, tag: "5", positionType: new PositionType({ label: "CORRER" }), specifications: "Cantó equerre/cara plaça" }),
      new DancePosition({ order: 2, tag: "6", positionType: new PositionType({ label: "CARLOTETA" }), specifications: "Mig equerre/cara plaça" }),
      new DancePosition({ order: 3, tag: "7", positionType: new PositionType({ label: "CARLOTETA" }), specifications: "Mig dret/cara plaça" }),
      new DancePosition({ order: 4, tag: "8", positionType: new PositionType({ label: "CORRER" }), specifications: "Cantó dret/cara plaça" }),
      new DancePosition({ order: 5, tag: "4", positionType: new PositionType({ label: "CORRER" }), specifications: "Cantó equerre/esquena plaça" }),
      new DancePosition({ order: 6, tag: "3", positionType: new PositionType({ label: "CARLOTETA" }), specifications: "Mig esquerre/esquena plaça" }),
      new DancePosition({ order: 7, tag: "2", positionType: new PositionType({ label: "CARLOTETA" }), specifications: "Mig dret/esquena plaça" }),
      new DancePosition({ order: 8, tag: "1", positionType: new PositionType({ label: "CORRER" }), specifications: "Cantó dret/esquena plaça" }),
    ],
    audios: [
      new DanceMusic({ fileId: "1IV0yshP7Xly9L-B07dqq2xCfAmCPRTkg", title: "La boja - Per assajar", artist: "Reina, Josep i Quim" }),
      new DanceMusic({ fileId: "1Qp5hcUzq25SIJPsEq6QyKvvFv4KhnR4t", title: "La boja - A plaça", artist: "-" }),
    ],
  }),
  new Dance({
    name: "La boja de 6",
    structure: new DanceStructure({ rows: 2, columns: 3 }),
    diagram: new DanceDiagram({blockName: "Grup", backgroundColor: {"CARLOTETA":"#FFF2CC", "CORRER":"#92D050"}, textColor: {"CARLOTETA":"#000000", "CORRER":"#000000"}}),
    minGroups: 1,
    positions: [
      new DancePosition({ order: 1, tag: "4", positionType: new PositionType({ label: "CORRER" }), specifications: "Cantó equerre/cara plaça" }),
      new DancePosition({ order: 2, tag: "5", positionType: new PositionType({ label: "CARLOTETA" }), specifications: "Mig/cara plaça" }),
      new DancePosition({ order: 3, tag: "6", positionType: new PositionType({ label: "CORRER" }), specifications: "Cantó dret/cara plaça" }),
      new DancePosition({ order: 4, tag: "3", positionType: new PositionType({ label: "CORRER" }), specifications: "Cantó equerre/esquena plaça" }),
      new DancePosition({ order: 5, tag: "2", positionType: new PositionType({ label: "CARLOTETA" }), specifications: "Mig/esquena plaça" }),
      new DancePosition({ order: 6, tag: "1", positionType: new PositionType({ label: "CORRER" }), specifications: "Cantó dret/esquena plaça" }),
    ],
    audios: [
      new DanceMusic({ fileId: "1IV0yshP7Xly9L-B07dqq2xCfAmCPRTkg", title: "La boja - Per assajar", artist: "Reina, Josep i Quim" }),
      new DanceMusic({ fileId: "1Qp5hcUzq25SIJPsEq6QyKvvFv4KhnR4t", title: "La boja - A plaça", artist: "-" }),
    ],
  }),
  // FALTA CONFIG
  new Dance({
    name: "Micalet",
    structure: new DanceStructure({ rows: 2, columns: 2 }),
    diagram: new DanceDiagram({blockName: "Quadre", backgroundColor: {"ANTIHORARI":"#FFF2CC", "HORARI":"#92D050"}, textColor: {"ANTIHORARI":"#000000", "HORARI":"#000000"}}),
    minGroups: 1,
    positions: [
      new DancePosition({ order: 1, tag: "3", positionType: new PositionType({ label: "ANTIHORARI" }), specifications: "Esquerre/cara plaça" }),
      new DancePosition({ order: 2, tag: "4", positionType: new PositionType({ label: "ANTIHORARI" }), specifications: "Dreta/cara plaça" }),
      new DancePosition({ order: 3, tag: "2", positionType: new PositionType({ label: "HORARI" }), specifications: "Esquerre/esquena plaça" }),
      new DancePosition({ order: 4, tag: "1", positionType: new PositionType({ label: "HORARI" }), specifications: "Dreta/esquena plaça" }),
    ]
  }),
  new Dance({
    name: "No en volem cap",
    structure: new DanceStructure({ rows: 2, columns: 2 }),
    diagram: new DanceDiagram({blockName: "Quadre", backgroundColor: {"FORA":"#92D050", "DINS":"#FFF2CC"}, textColor: {"FORA":"#000000", "DINS":"#000000"}}),
    minGroups: 1,
    positions: [
      new DancePosition({ order: 1, tag: "3", positionType: new PositionType({ label: "FORA" }), specifications: "Esquerre/cara plaça" }),
      new DancePosition({ order: 2, tag: "4", positionType: new PositionType({ label: "DINS" }), specifications: "Dreta/cara plaça" }),
      new DancePosition({ order: 3, tag: "2", positionType: new PositionType({ label: "DINS" }), specifications: "Esquerre/esquena plaça" }),
      new DancePosition({ order: 4, tag: "1", positionType: new PositionType({ label: "FORA" }), specifications: "Dreta/esquena plaça" }),
    ]
  }),
  new Dance({
    name: "Joan del riu",
    structure: new DanceStructure({ rows: 2, columns: 2 }),
    diagram: new DanceDiagram({blockName: "Grup", backgroundColor: {"BAIX":"#FFF2CC", "DALT":"#92D050"}, textColor: {"BAIX":"#000000", "DALT":"#000000"}}),
    minGroups: 1,
    positions: [
      new DancePosition({ order: 1, tag: "4", positionType: new PositionType({ label: "DALT" }), specifications: "Cantó equerre/cara plaça" }),
      new DancePosition({ order: 2, tag: "3", positionType: new PositionType({ label: "BAIX" }), specifications: "Cantó dret/cara plaça" }),
      new DancePosition({ order: 3, tag: "2", positionType: new PositionType({ label: "BAIX" }), specifications: "Cantó equerre/esquena plaça" }),
      new DancePosition({ order: 4, tag: "1", positionType: new PositionType({ label: "DALT" }), specifications: "Cantó dret/esquena plaça" }),
    ]
  }),
  new Dance({
    name: "Joan del riu de 16",
    structure: new DanceStructure({ rows: 2, columns: 8 }),
    diagram: new DanceDiagram({blockName: "Grup", backgroundColor: {"BAIX":"#FFF2CC", "DALT":"#92D050"}, textColor: {"BAIX":"#000000", "DALT":"#000000"}}),
    minGroups: 1,
    positions: [
      new DancePosition({ order: 1, tag: "9", positionType: new PositionType({ label: "DALT" }), specifications: "Cantó equerre/cara plaça" }),
      new DancePosition({ order: 2, tag: "10", positionType: new PositionType({ label: "BAIX" }), specifications: "Mig equerre/cara plaça" }),
      new DancePosition({ order: 3, tag: "11", positionType: new PositionType({ label: "DALT" }), specifications: "Mig dret/cara plaça" }),
      new DancePosition({ order: 4, tag: "12", positionType: new PositionType({ label: "BAIX" }), specifications: "Cantó dret/cara plaça" }),
      new DancePosition({ order: 5, tag: "13", positionType: new PositionType({ label: "DALT" }), specifications: "Cantó equerre/esquena plaça" }),
      new DancePosition({ order: 6, tag: "14", positionType: new PositionType({ label: "BAIX" }), specifications: "Mig esquerre/esquena plaça" }),
      new DancePosition({ order: 7, tag: "15", positionType: new PositionType({ label: "DALT" }), specifications: "Mig dret/esquena plaça" }),
      new DancePosition({ order: 8, tag: "16", positionType: new PositionType({ label: "BAIX" }), specifications: "Cantó dret/esquena plaça" }),
      new DancePosition({ order: 9, tag: "8", positionType: new PositionType({ label: "BAIX" }), specifications: "Cantó equerre/cara plaça" }),
      new DancePosition({ order: 10, tag: "7", positionType: new PositionType({ label: "DALT" }), specifications: "Mig equerre/cara plaça" }),
      new DancePosition({ order: 11, tag: "6", positionType: new PositionType({ label: "BAIX" }), specifications: "Mig dret/cara plaça" }),
      new DancePosition({ order: 12, tag: "5", positionType: new PositionType({ label: "DALT" }), specifications: "Cantó dret/cara plaça" }),
      new DancePosition({ order: 13, tag: "4", positionType: new PositionType({ label: "BAIX" }), specifications: "Cantó equerre/esquena plaça" }),
      new DancePosition({ order: 14, tag: "3", positionType: new PositionType({ label: "DALT" }), specifications: "Mig esquerre/esquena plaça" }),
      new DancePosition({ order: 15, tag: "2", positionType: new PositionType({ label: "BAIX" }), specifications: "Mig dret/esquena plaça" }),
      new DancePosition({ order: 16, tag: "1", positionType: new PositionType({ label: "DALT" }), specifications: "Cantó dret/esquena plaça" }),
    ]
  }),
  new Dance({
    name: "Passi-ho bé",
    structure: new DanceStructure({ rows: 2, columns: 2 }),
    diagram: new DanceDiagram({blockName: "Grup", backgroundColor: {"POSICIÓ":"#FFF2CC"}, textColor: {"POSICIÓ":"#000000"}}),
    minGroups: 1,
    positions: [
      new DancePosition({ order: 1, tag: "4", positionType: new PositionType({ label: "POSICIÓ" }), specifications: "Cantó equerre/cara plaça" }),
      new DancePosition({ order: 2, tag: "3", positionType: new PositionType({ label: "POSICIÓ" }), specifications: "Cantó dret/cara plaça" }),
      new DancePosition({ order: 3, tag: "2", positionType: new PositionType({ label: "POSICIÓ" }), specifications: "Cantó equerre/esquena plaça" }),
      new DancePosition({ order: 4, tag: "1", positionType: new PositionType({ label: "POSICIÓ" }), specifications: "Cantó dret/esquena plaça" }),
    ],
  }),
];

try {
  const jsonData = JSON.stringify(DANCES, null, 2);
  fs.writeFileSync('docs/scripts/dances.js', `const DANCES = ${jsonData};`, 'utf8');
  console.log('Success: dances.json created.');
} catch (err) {
  console.error('Error writing file:', err);
}