import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase/config";
import { HalaqahGroup, HalaqahGroupMember } from "../types";

const GROUPS_COLLECTION = "halaqah_groups";
const MEMBERS_COLLECTION = "halaqah_group_members";

export const halaqahGroupService = {
  // Get groups
  async getGroups(musrifId?: string): Promise<HalaqahGroup[]> {
    const colRef = collection(db, GROUPS_COLLECTION);
    let q = query(colRef);
    
    if (musrifId) {
      q = query(colRef, where("musrifId", "==", musrifId));
    }

    try {
      const querySnapshot = await getDocs(q);
      const items: HalaqahGroup[] = [];
      querySnapshot.forEach((docSnap) => {
        items.push({
          id: docSnap.id,
          ...docSnap.data()
        } as HalaqahGroup);
      });
      // Sort in memory by groupName ascending
      items.sort((a, b) => (a.groupName || "").localeCompare(b.groupName || ""));
      return items;
    } catch (error) {
      return handleFirestoreError(error, OperationType.LIST, GROUPS_COLLECTION);
    }
  },

  // Create Group
  async createGroup(data: Omit<HalaqahGroup, "id" | "createdAt" | "updatedAt">): Promise<HalaqahGroup> {
    const colRef = collection(db, GROUPS_COLLECTION);
    const newDocRef = doc(colRef);
    const now = new Date().toISOString();
    const newGroup: HalaqahGroup = {
      id: newDocRef.id,
      ...data,
      createdAt: now,
      updatedAt: now
    };

    try {
      await setDoc(newDocRef, newGroup);
      return newGroup;
    } catch (error) {
      return handleFirestoreError(error, OperationType.WRITE, `${GROUPS_COLLECTION}/${newDocRef.id}`);
    }
  },

  // Update Group
  async updateGroup(id: string, data: Partial<HalaqahGroup>): Promise<void> {
    const docRef = doc(db, GROUPS_COLLECTION, id);
    const updateData = {
      ...data,
      updatedAt: new Date().toISOString()
    };

    try {
      await updateDoc(docRef, updateData);
    } catch (error) {
      return handleFirestoreError(error, OperationType.WRITE, `${GROUPS_COLLECTION}/${id}`);
    }
  },

  // Delete Group (and ideally its members)
  async deleteGroup(id: string): Promise<void> {
    const docRef = doc(db, GROUPS_COLLECTION, id);

    try {
      // Delete the group document
      await deleteDoc(docRef);

      // Clean up members in this group
      const membersRef = collection(db, MEMBERS_COLLECTION);
      const q = query(membersRef, where("groupId", "==", id));
      const querySnapshot = await getDocs(q);
      
      const deletePromises = querySnapshot.docs.map(docSnap => deleteDoc(docSnap.ref));
      await Promise.all(deletePromises);
    } catch (error) {
      return handleFirestoreError(error, OperationType.DELETE, `${GROUPS_COLLECTION}/${id}`);
    }
  },

  // Add Member
  async addMember(member: Omit<HalaqahGroupMember, "id" | "createdAt" | "updatedAt">): Promise<HalaqahGroupMember> {
    const colRef = collection(db, MEMBERS_COLLECTION);
    const newDocRef = doc(colRef);
    const now = new Date().toISOString();
    const newMember: HalaqahGroupMember = {
      id: newDocRef.id,
      ...member,
      createdAt: now,
      updatedAt: now
    };

    try {
      await setDoc(newDocRef, newMember);
      return newMember;
    } catch (error) {
      return handleFirestoreError(error, OperationType.WRITE, `${MEMBERS_COLLECTION}/${newDocRef.id}`);
    }
  },

  // Remove Member
  async removeMember(memberId: string): Promise<void> {
    const docRef = doc(db, MEMBERS_COLLECTION, memberId);

    try {
      await deleteDoc(docRef);
    } catch (error) {
      return handleFirestoreError(error, OperationType.DELETE, `${MEMBERS_COLLECTION}/${memberId}`);
    }
  },

  // Get Members of a Group
  async getMembers(groupId: string): Promise<HalaqahGroupMember[]> {
    const colRef = collection(db, MEMBERS_COLLECTION);
    const q = query(colRef, where("groupId", "==", groupId));

    try {
      const querySnapshot = await getDocs(q);
      const items: HalaqahGroupMember[] = [];
      querySnapshot.forEach((docSnap) => {
        items.push({
          id: docSnap.id,
          ...docSnap.data()
        } as HalaqahGroupMember);
      });
      return items;
    } catch (error) {
      return handleFirestoreError(error, OperationType.LIST, MEMBERS_COLLECTION);
    }
  },

  // Get All Members across all groups
  async getAllMembers(): Promise<HalaqahGroupMember[]> {
    const colRef = collection(db, MEMBERS_COLLECTION);
    try {
      const querySnapshot = await getDocs(colRef);
      const items: HalaqahGroupMember[] = [];
      querySnapshot.forEach((docSnap) => {
        items.push({
          id: docSnap.id,
          ...docSnap.data()
        } as HalaqahGroupMember);
      });
      return items;
    } catch (error) {
      return handleFirestoreError(error, OperationType.LIST, MEMBERS_COLLECTION);
    }
  }
};
