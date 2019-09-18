import {RecordData} from './index';

export type SingleSyncCallback = (syncResult: RecordData) => void;
export type MultiSyncCallback = (syncResult: Array<RecordData>) => void;
