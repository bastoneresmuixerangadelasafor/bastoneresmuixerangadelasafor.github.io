
import fs from 'node:fs';
import { Dance } from '../model/generated/Dance.js';
import { DanceDiagram } from '../model/generated/DanceDiagram.js';
import { DanceMusic } from '../model/generated/DanceMusic.js';
import { DancePosition } from '../model/generated/DancePosition.js';
import { DanceStructure } from '../model/generated/DanceStructure.js';
import { DanceStructureForm } from '../model/generated/DanceStructureForm.js';
import { DanceVideo } from '../model/generated/DanceVideo.js';
import { PositionType } from '../model/generated/PositionType.js';

const DANCES = [
  new Dance({
    name: "La polca",
    structure: new DanceStructure({ rows: 2, columns: 4, forms: [new DanceStructureForm(DanceStructureForm.GRID)] }),
    diagram: new DanceDiagram({blockName: "Grup", backgroundColor: {"BAIX":"#FFF2CC", "DALT":"#92D050"}, textColor: {"BAIX":"#000000", "DALT":"#000000"}}),
    minGroups: 1,
    showInPositions: true,
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
      new DanceMusic({ fileId: "1Oz7GCasuPWfVLZeHJytelv85zCw3PhOx", title: "La polca - Per assajar", artist: "Reina, Josep i Quim" }),
      new DanceMusic({ fileId: "1znGxmydFqQHy8dyjlNnFcHmfZe9wLpPn", title: "La polca - A plaça", artist: "-" }),
    ],
    videos: [
      new DanceVideo({ url: "https://www.youtube.com/watch?v=craVzFsoBr0", title: "La polca - Vídeo" }),
    ],
  }),
  new Dance({
    name: "Ara i sempre",
    structure: new DanceStructure({ rows: 2, columns: 1, forms: [new DanceStructureForm(DanceStructureForm.RADIAL), new DanceStructureForm(DanceStructureForm.GRID)] }),
    diagram: new DanceDiagram({blockName: "Parella", backgroundColor: {"ANTIHORARI":"#FFF2CC", "HORARI":"#92D050"}, textColor: {"ANTIHORARI":"#000000", "HORARI":"#000000"}}),
    minGroups: 3,
    showInPositions: true,
    positions: [
      new DancePosition({ order: 1, tag: "1", positionType: new PositionType({ label: "ANTIHORARI" }), specifications: "Antihorari" }),
      new DancePosition({ order: 2, tag: "2", positionType: new PositionType({ label: "HORARI" }), specifications: "Horari" }),
    ],
    audios: [
      new DanceMusic({ fileId: "1miptCmAVlHV14bdmPYGdg37o5YaTQZoV", title: "Ara i sempre - Per assajar", artist: "Reina, Josep i Quim" }),
    ],
    videos: [
      new DanceVideo({ url: "https://www.youtube.com/watch?v=k59k8eoTvWI", title: "Ara i sempre - Vídeo" }),
    ],
  }),
  new Dance({
    name: "La boja de 8",
    structure: new DanceStructure({ rows: 2, columns: 4, forms: [new DanceStructureForm(DanceStructureForm.GRID)] }),
    diagram: new DanceDiagram({blockName: "Grup", backgroundColor: {"CARLOTETA":"#FFF2CC", "CORRER":"#92D050"}, textColor: {"CARLOTETA":"#000000", "CORRER":"#000000"}}),
    minGroups: 1,
    showInPositions: true,
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
    videos: [
      new DanceVideo({ url: "https://www.youtube.com/watch?v=1NtSGdDefO0", title: "La boja de 8 - Vídeo" }),
    ],
  }),
  new Dance({
    name: "La boja de 6",
    structure: new DanceStructure({ rows: 2, columns: 3, forms: [new DanceStructureForm(DanceStructureForm.GRID)] }),
    diagram: new DanceDiagram({blockName: "Grup", backgroundColor: {"CARLOTETA":"#FFF2CC", "CORRER":"#92D050"}, textColor: {"CARLOTETA":"#000000", "CORRER":"#000000"}}),
    minGroups: 1,
    showInPositions: true,
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
    videos: [
      new DanceVideo({ url: "https://www.youtube.com/watch?v=k_JYBS5HlSQ", title: "La boja de 6 - Vídeo" }),
    ],
  }),
  new Dance({
    name: "La boja de 4",
    structure: new DanceStructure({ rows: 2, columns: 2, forms: [new DanceStructureForm(DanceStructureForm.GRID)] }),
    diagram: new DanceDiagram({blockName: "Grup", backgroundColor: {"CARLOTETA":"#FFF2CC", "CORRER":"#92D050"}, textColor: {"CARLOTETA":"#000000", "CORRER":"#000000"}}),
    minGroups: 1,
    showInPositions: true,
    positions: [
      new DancePosition({ order: 1, tag: "4", positionType: new PositionType({ label: "CORRER" }), specifications: "Cantó equerre/cara plaça" }),
      new DancePosition({ order: 2, tag: "3", positionType: new PositionType({ label: "CARLOTETA" }), specifications: "Cantó dret/cara plaça" }),
      new DancePosition({ order: 3, tag: "2", positionType: new PositionType({ label: "CARLOTETA" }), specifications: "Cantó equerre/esquena plaça" }),
      new DancePosition({ order: 4, tag: "1", positionType: new PositionType({ label: "CORRER" }), specifications: "Cantó dret/esquena plaça" }),
    ],
    audios: [
      new DanceMusic({ fileId: "1IV0yshP7Xly9L-B07dqq2xCfAmCPRTkg", title: "La boja - Per assajar", artist: "Reina, Josep i Quim" }),
      new DanceMusic({ fileId: "1Qp5hcUzq25SIJPsEq6QyKvvFv4KhnR4t", title: "La boja - A plaça", artist: "-" }),
    ],
    videos: [],
  }),
  new Dance({
    name: "Micalet",
    structure: new DanceStructure({ rows: 2, columns: 2, forms: [new DanceStructureForm(DanceStructureForm.GRID)] }),
    diagram: new DanceDiagram({blockName: "Quadre", backgroundColor: {"ANTIHORARI":"#FFF2CC", "HORARI":"#92D050"}, textColor: {"ANTIHORARI":"#000000", "HORARI":"#000000"}}),
    minGroups: 1,
    showInPositions: true,
    positions: [
      new DancePosition({ order: 1, tag: "3", positionType: new PositionType({ label: "ANTIHORARI" }), specifications: "Esquerre/cara plaça" }),
      new DancePosition({ order: 2, tag: "4", positionType: new PositionType({ label: "ANTIHORARI" }), specifications: "Dreta/cara plaça" }),
      new DancePosition({ order: 3, tag: "2", positionType: new PositionType({ label: "HORARI" }), specifications: "Esquerre/esquena plaça" }),
      new DancePosition({ order: 4, tag: "1", positionType: new PositionType({ label: "HORARI" }), specifications: "Dreta/esquena plaça" }),
    ],
    videos: [
      new DanceVideo({ url: "https://www.youtube.com/watch?v=ni0Hbde2XDc", title: "Micalet - Vídeo" }),
    ],
  }),
  new Dance({
    name: "No en volem cap",
    structure: new DanceStructure({ rows: 2, columns: 2, forms: [new DanceStructureForm(DanceStructureForm.GRID)] }),
    diagram: new DanceDiagram({blockName: "Quadre", backgroundColor: {"FORA":"#92D050", "DINS":"#FFF2CC"}, textColor: {"FORA":"#000000", "DINS":"#000000"}}),
    minGroups: 1,
    showInPositions: true,
    positions: [
      new DancePosition({ order: 1, tag: "3", positionType: new PositionType({ label: "FORA" }), specifications: "Esquerre/cara plaça" }),
      new DancePosition({ order: 2, tag: "4", positionType: new PositionType({ label: "DINS" }), specifications: "Dreta/cara plaça" }),
      new DancePosition({ order: 3, tag: "2", positionType: new PositionType({ label: "DINS" }), specifications: "Esquerre/esquena plaça" }),
      new DancePosition({ order: 4, tag: "1", positionType: new PositionType({ label: "FORA" }), specifications: "Dreta/esquena plaça" }),
    ],
    audios: [
      new DanceMusic({ fileId: "1jddJfWzWomotfe-wAXIXWY-bFrG7Tp_F", title: "No en volem cap - Per assajar (completa)", artist: "Reina, Josep i Quim" }),
      new DanceMusic({ fileId: "1DoaFbvJZLJPqB1DcrD4ZXAeYXslmFspU", title: "No en volem cap - Per assajar (sense intro)", artist: "Reina, Josep i Quim" }),
      new DanceMusic({ fileId: "1q10nIzTSyRAFZRtiPVo8r_2Ga3kiEPnM", title: "No en volem cap - A plaça", artist: "-" }),
    ],
    videos: [
      new DanceVideo({ url: "https://www.youtube.com/watch?v=gYXeQtEt3D0", title: "No en volem cap - Vídeo" }),
    ],
  }),
  new Dance({
    name: "Joan del riu",
    structure: new DanceStructure({ rows: 2, columns: 2, forms: [new DanceStructureForm(DanceStructureForm.GRID)] }),
    diagram: new DanceDiagram({blockName: "Grup", backgroundColor: {"HORARI/PRIMER BAIX":"#FFF2CC", "ANTIHORARI/PRIMER DALT":"#92D050"}, textColor: {"HORARI/PRIMER BAIX":"#000000", "ANTIHORARI/PRIMER DALT":"#000000"}}),
    minGroups: 1,
    showInPositions: true,
    positions: [
      new DancePosition({ order: 1, tag: "4", positionType: new PositionType({ label: "ANTIHORARI/PRIMER DALT" }), specifications: "Cantó equerre/cara plaça" }),
      new DancePosition({ order: 2, tag: "3", positionType: new PositionType({ label: "HORARI/PRIMER BAIX" }), specifications: "Cantó dret/cara plaça" }),
      new DancePosition({ order: 3, tag: "2", positionType: new PositionType({ label: "HORARI/PRIMER BAIX" }), specifications: "Cantó equerre/esquena plaça" }),
      new DancePosition({ order: 4, tag: "1", positionType: new PositionType({ label: "ANTIHORARI/PRIMER DALT" }), specifications: "Cantó dret/esquena plaça" }),
    ],
    audios: [
      new DanceMusic({ fileId: "1XIhGj3cylFK2velpOdpWX4bW8FHx9RaT", title: "Joan del riu - Per assajar", artist: "Reina, Josep i Quim" }),
    ],
    videos: [
      new DanceVideo({ url: "https://www.youtube.com/shorts/QOpS3oI0hXQ", title: "Joan del riu - Vídeo" }),
    ],
  }),
  new Dance({
    name: "Passi-ho bé",
    structure: new DanceStructure({ rows: 2, columns: 2, forms: [new DanceStructureForm(DanceStructureForm.GRID)] }),
    diagram: new DanceDiagram({blockName: "Grup", backgroundColor: {"POSICIÓ":"#FFF2CC"}, textColor: {"POSICIÓ":"#000000"}}),
    minGroups: 1,
    showInPositions: true,
    positions: [
      new DancePosition({ order: 1, tag: "4", positionType: new PositionType({ label: "POSICIÓ" }), specifications: "Cantó equerre/cara plaça" }),
      new DancePosition({ order: 2, tag: "3", positionType: new PositionType({ label: "POSICIÓ" }), specifications: "Cantó dret/cara plaça" }),
      new DancePosition({ order: 3, tag: "2", positionType: new PositionType({ label: "POSICIÓ" }), specifications: "Cantó equerre/esquena plaça" }),
      new DancePosition({ order: 4, tag: "1", positionType: new PositionType({ label: "POSICIÓ" }), specifications: "Cantó dret/esquena plaça" }),
    ],
    audios: [
      new DanceMusic({ fileId: "1gNplR0UF5LpWZrWv4O-zP1WbVtz6DRuu", title: "Passi-ho bé - A plaça", artist: "-" }),
    ],
  }),
  new Dance({
    name: "Palmera boja",
    structure: new DanceStructure({ rows: 2, columns: 2, forms: [new DanceStructureForm(DanceStructureForm.GRID)] }),
    diagram: new DanceDiagram({blockName: "Grup", backgroundColor: {"ENTRA DESPRES":"#FFF2CC", "ENTRA PRIMER":"#92D050"}, textColor: {"ENTRA PRIMER":"#000000", "ENTRA DESPRES":"#000000"}}),
    minGroups: 1,
    showInPositions: true,
    positions: [
      new DancePosition({ order: 1, tag: "4", positionType: new PositionType({ label: "ENTRA PRIMER" }), specifications: "Cantó equerre/cara plaça" }),
      new DancePosition({ order: 2, tag: "3", positionType: new PositionType({ label: "ENTRA DESPRES" }), specifications: "Cantó dret/cara plaça" }),
      new DancePosition({ order: 3, tag: "2", positionType: new PositionType({ label: "ENTRA DESPRES" }), specifications: "Cantó equerre/esquena plaça" }),
      new DancePosition({ order: 4, tag: "1", positionType: new PositionType({ label: "ENTRA PRIMER" }), specifications: "Cantó dret/esquena plaça" }),
    ],
    audios: [
      new DanceMusic({ fileId: "1NCrAQ8Xa_VNXiKqTA7WhlvglteFRXtSY", title: "Palmera boja - A plaça", artist: "-" }),
    ],
    videos: [
    ],
  }),
  new Dance({
    name: "De 2 a 4",
    structure: new DanceStructure({ rows: 2, columns: 4, forms: [new DanceStructureForm(DanceStructureForm.GRID)] }),
    diagram: new DanceDiagram({blockName: "Grup", backgroundColor: {"ABC":"#FFF2CC", "ESTATUA":"#92D050"}, textColor: {"ABC":"#000000", "ESTATUA":"#000000"}}),
    minGroups: 1,
    showInPositions: true,
    positions: [
      new DancePosition({ order: 1, tag: "5", positionType: new PositionType({ label: "ESTATUA" }), specifications: "Cantó equerre/cara plaça" }),
      new DancePosition({ order: 2, tag: "6", positionType: new PositionType({ label: "ABC" }), specifications: "Mig equerre/cara plaça" }),
      new DancePosition({ order: 3, tag: "7", positionType: new PositionType({ label: "ESTATUA" }), specifications: "Mig dret/cara plaça" }),
      new DancePosition({ order: 4, tag: "8", positionType: new PositionType({ label: "ABC" }), specifications: "Cantó dret/cara plaça" }),
      new DancePosition({ order: 5, tag: "4", positionType: new PositionType({ label: "ABC" }), specifications: "Cantó equerre/esquena plaça" }),
      new DancePosition({ order: 6, tag: "3", positionType: new PositionType({ label: "ESTATUA" }), specifications: "Mig esquerre/esquena plaça" }),
      new DancePosition({ order: 7, tag: "2", positionType: new PositionType({ label: "ABC" }), specifications: "Mig dret/esquena plaça" }),
      new DancePosition({ order: 8, tag: "1", positionType: new PositionType({ label: "ESTATUA" }), specifications: "Cantó dret/esquena plaça" }),
    ],
    audios: [
    ],
    videos: [
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