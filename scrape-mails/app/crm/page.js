'use client';

import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '../components/ui/DashboardLayout';
import CRM from '../components/CRM';
import { useNotifications } from '../components/ui/NotificationProvider';

// Import Firebase functions
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, getDocs, updateDoc, doc, addDoc } from 'firebase/firestore';

const firebaseConfig = {
  // Your Firebase config
};

const db = getFirestore(initializeApp(firebaseConfig));

export default function CRMPage() {
  const { addNotification } = useNotifications();
  const [data, setData] = useState({
    leads: [],
    contacts: {},
    repliedLeads: {},
    leadScores: {},
    dealStages: {},
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCRMData();
  }, []);

  const loadCRMData = async () => {
    try {
      // Load leads
      const leadsRef = collection(db, 'leads');
      const leadsSnapshot = await getDocs(leadsRef);
      const leads = leadsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Load contacts
      const contactsRef = collection(db, 'contacts');
      const contactsSnapshot = await getDocs(contactsRef);
      const contacts = {};
      contactsSnapshot.docs.forEach(doc => {
        const contact = doc.data();
        contacts[contact.email] = contact;
      });

      // Load replies
      const repliesRef = collection(db, 'replies');
      const repliesSnapshot = await getDocs(repliesRef);
      const repliedLeads = {};
      repliesSnapshot.docs.forEach(doc => {
        const reply = doc.data();
        repliedLeads[reply.email] = true;
      });

      // Calculate lead scores
      const leadScores = {};
      leads.forEach(lead => {
        let score = 0;
        if (lead.email) score += 20;
        if (lead.phone) score += 15;
        if (lead.website) score += 15;
        if (lead.industry) score += 10;
        if (repliedLeads[lead.email]) score += 40;
        leadScores[lead.email] = Math.min(score, 100);
      });

      // Deal stages
      const dealStages = {};
      leads.forEach(lead => {
        dealStages[lead.email] = lead.status || 'new';
      });

      setData({
        leads,
        contacts,
        repliedLeads,
        leadScores,
        dealStages,
      });
    } catch (error) {
      console.error('Error loading CRM data:', error);
      addNotification('Error loading CRM data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateLead = async (email, updates) => {
    try {
      // Find the lead document
      const leadsRef = collection(db, 'leads');
      const q = query(leadsRef, where('email', '==', email));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const leadDoc = querySnapshot.docs[0];
        await updateDoc(doc(db, 'leads', leadDoc.id), updates);

        // Update local state
        setData(prev => ({
          ...prev,
          leads: prev.leads.map(lead =>
            lead.email === email ? { ...lead, ...updates } : lead
          ),
          dealStages: {
            ...prev.dealStages,
            [email]: updates.status || prev.dealStages[email],
          },
        }));

        addNotification('Lead updated successfully', 'success');
      }
    } catch (error) {
      console.error('Error updating lead:', error);
      addNotification('Error updating lead', 'error');
    }
  };

  const handleAddNote = async (email, noteText) => {
    try {
      const note = {
        text: noteText,
        timestamp: new Date(),
        type: 'manual',
      };

      // Find the lead and update notes
      const leadsRef = collection(db, 'leads');
      const q = query(leadsRef, where('email', '==', email));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const leadDoc = querySnapshot.docs[0];
        const currentNotes = leadDoc.data().notes || [];
        await updateDoc(doc(db, 'leads', leadDoc.id), {
          notes: [...currentNotes, note],
        });

        // Update local state
        setData(prev => ({
          ...prev,
          leads: prev.leads.map(lead =>
            lead.email === email
              ? { ...lead, notes: [...(lead.notes || []), note] }
              : lead
          ),
        }));

        addNotification('Note added successfully', 'success');
      }
    } catch (error) {
      console.error('Error adding note:', error);
      addNotification('Error adding note', 'error');
    }
  };

  const handleScheduleFollowUp = async (email) => {
    try {
      const followUpDate = new Date();
      followUpDate.setDate(followUpDate.getDate() + 3); // 3 days from now

      // Find the lead and update next follow-up
      const leadsRef = collection(db, 'leads');
      const q = query(leadsRef, where('email', '==', email));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const leadDoc = querySnapshot.docs[0];
        await updateDoc(doc(db, 'leads', leadDoc.id), {
          nextFollowUp: followUpDate,
        });

        // Update local state
        setData(prev => ({
          ...prev,
          leads: prev.leads.map(lead =>
            lead.email === email
              ? { ...lead, nextFollowUp: followUpDate }
              : lead
          ),
        }));

        addNotification('Follow-up scheduled successfully', 'success');
      }
    } catch (error) {
      console.error('Error scheduling follow-up:', error);
      addNotification('Error scheduling follow-up', 'error');
    }
  };

  if (loading) {
    return (
      <DashboardLayout title="CRM" subtitle="Loading CRM data...">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Customer Relationship Management"
      subtitle="Manage leads, deals, and customer interactions"
    >
      <CRM
        leads={data.leads}
        contacts={data.contacts}
        repliedLeads={data.repliedLeads}
        leadScores={data.leadScores}
        dealStages={data.dealStages}
        onUpdateLead={handleUpdateLead}
        onAddNote={handleAddNote}
        onScheduleFollowUp={handleScheduleFollowUp}
      />
    </DashboardLayout>
  );
}