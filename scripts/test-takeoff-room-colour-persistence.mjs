import assert from 'node:assert/strict';
import { mergeRoomReadings } from '../components/construction-estimation/ai-plan-takeoff/ai-integration/roomSchedule.js';
import { roomDisplayFill } from '../components/construction-estimation/ai-plan-takeoff/ai-integration/roomAppearance.js';
const room = { id: 'room-1', name: 'Office', page: 1, level: 'Ground Floor', x: .2, y: .2,
  polygon: [{ x: 10, y: 10 }, { x: 100, y: 10 }, { x: 100, y: 100 }, { x: 10, y: 100 }],
  source: 'plan', selected: true, displayColor: '#16a34a', areaM2: 81, reviewRequired: true };
const saved = JSON.parse(JSON.stringify([room]));
const result = mergeRoomReadings(saved, [{ page: 1, level: 'Ground Floor', rooms: [{ ...room, displayColor: undefined, selected: false }] }]);
assert.equal(result.length, 1);
assert.equal(result[0].displayColor, '#16a34a');
assert.equal(result[0].selected, true);
assert.equal(result[0].reviewRequired, true, 'colour cannot confirm uncertain geometry');
assert.equal(roomDisplayFill(result[0], false), 'rgba(22,163,74,0.35)');
assert.equal(roomDisplayFill({ ...result[0], selected: false }, false), 'rgba(22,163,74,0.12)');
assert.equal(roomDisplayFill({ displayColor: 'invalid' }, true), 'rgba(37,99,235,0.28)');
const renamed = mergeRoomReadings([{ ...room, name: 'Study', label: 'Office', nameEdited: true }], [{ page: 1, level: 'Ground Floor', rooms: [room] }]);
assert.equal(renamed[0].name, 'Study', 'A corrected room name survives re-measurement without falsely confirming the boundary');
assert.equal(renamed[0].reviewRequired, true);
console.log('Room colour survives serialization and re-analysis without changing geometry admission.');
