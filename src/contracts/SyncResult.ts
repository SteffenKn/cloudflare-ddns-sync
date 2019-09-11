import {Record} from './index';

export type SingleSyncResult = Promise<Record>;
export type MultiSyncResult = Promise<Array<Record>>;
