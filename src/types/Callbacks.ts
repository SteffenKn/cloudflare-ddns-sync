import {RecordData} from './index.js';

export type SingleSyncCallback = (syncResult: RecordData) => void;
export type MultiSyncCallback = (syncResult: Array<RecordData>) => void;
