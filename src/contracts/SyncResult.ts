import {RecordData} from './index';

export type SingleSyncResult = Promise<RecordData>;
export type MultiSyncResult = Promise<Array<RecordData>>;
