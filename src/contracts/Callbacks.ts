import {Record} from './index';

export type SingleSyncCallback = (syncResult: Record) => void;
export type MultiSyncCallback = (syncResult: Array<Record>) => void;
