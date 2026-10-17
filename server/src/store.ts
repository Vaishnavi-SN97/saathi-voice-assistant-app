import { randomUUID } from "node:crypto";
import type { Firestore } from "firebase-admin/firestore";

export type Doc = Record<string, any>;

/** Minimal document-store interface; Firestore in prod, in-memory in tests. */
export interface Store {
  get(path: string): Promise<Doc | null>;
  set(path: string, data: Doc): Promise<void>;
  /** Create a doc with an auto id under a collection path; returns the id. */
  add(collection: string, data: Doc): Promise<string>;
  delete(path: string): Promise<void>;
  /** Documents directly inside a collection (not their sub-collections), with ids. */
  list(collection: string): Promise<{ id: string; data: Doc }[]>;
}

export class FirestoreStore implements Store {
  constructor(private db: Firestore) {}
  async get(path: string) {
    const s = await this.db.doc(path).get();
    return s.exists ? (s.data() as Doc) : null;
  }
  async set(path: string, data: Doc) {
    await this.db.doc(path).set(data);
  }
  async add(collection: string, data: Doc) {
    const ref = await this.db.collection(collection).add(data);
    return ref.id;
  }
  async delete(path: string) {
    await this.db.doc(path).delete();
  }
  async list(collection: string) {
    const snap = await this.db.collection(collection).get();
    return snap.docs.map((d) => ({ id: d.id, data: d.data() as Doc }));
  }
}

export class MemoryStore implements Store {
  docs = new Map<string, Doc>();
  async get(path: string) {
    return this.docs.get(path) ?? null;
  }
  async set(path: string, data: Doc) {
    this.docs.set(path, data);
  }
  async add(collection: string, data: Doc) {
    const id = randomUUID();
    this.docs.set(`${collection}/${id}`, data);
    return id;
  }
  async delete(path: string) {
    this.docs.delete(path);
  }
  async list(collection: string) {
    const depth = collection.split("/").length + 1;
    return [...this.docs.entries()]
      .filter(([k]) => k.startsWith(collection + "/") && k.split("/").length === depth)
      .map(([k, data]) => ({ id: k.split("/").pop()!, data }));
  }
}
