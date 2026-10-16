import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin
let firebaseInitialized = false;
let db: any = null;

try {
  const configPath = path.resolve(__dirname, 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    const serviceConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const adminApp = initializeApp({
      projectId: serviceConfig.projectId,
    });
    db = getFirestore(adminApp, serviceConfig.firestoreDatabaseId);
    firebaseInitialized = true;
    console.log('Firebase Admin initialized with project ID:', serviceConfig.projectId);
  } else {
    const adminApp = initializeApp();
    db = getFirestore(adminApp);
    firebaseInitialized = true;
  }
} catch (e) {
  console.warn('Firebase Admin initialization warning:', e);
}

async function startServer() {
  const app = express();
  app.use(express.json());

  // API Route: Process Monthly Deduction Uploads (Cloud Function backend logic)
  app.post('/api/deductions/upload', async (req, res) => {
    try {
      const { deductionsBatch, userId, monthYear } = req.body;

      if (!Array.isArray(deductionsBatch) || deductionsBatch.length === 0) {
        return res.status(400).json({ error: 'Invalid or empty deductions batch data.' });
      }

      if (!db) {
        return res.status(500).json({ error: 'Database not initialized.' });
      }

      const batchResult = {
        successCount: 0,
        errors: [] as string[],
      };

      const firestoreBatch = db.batch();
      const auditLogRef = db.collection('auditLogs').doc();

      for (const row of deductionsBatch) {
        const { employeeNumber, sharesAmount, principalAmount, interestAmount } = row;

        if (!employeeNumber) {
          batchResult.errors.push(`Missing employee number in row: ${JSON.stringify(row)}`);
          continue;
        }

        const shares = Number(sharesAmount) || 0;
        const principal = Number(principalAmount) || 0;
        const interest = Number(interestAmount) || 0;
        const totalDeducted = shares + principal + interest;

        // Find member by employeeNumber
        const membersSnapshot = await db.collection('members').where('employeeNumber', '==', employeeNumber).get();
        
        if (membersSnapshot.empty) {
          batchResult.errors.push(`Employee number ${employeeNumber} not found in SACCO member records.`);
          continue;
        }

        const memberDoc = membersSnapshot.docs[0];
        const memberData = memberDoc.data();
        const memberId = memberData.memberId;

        // Create deduction record
        const deductionRef = db.collection('deductions').doc();
        firestoreBatch.set(deductionRef, {
          deductionId: deductionRef.id,
          memberId,
          monthYear: monthYear || 'October 2026',
          sharesAmount: shares,
          principalAmount: principal,
          interestAmount: interest,
          totalDeducted,
          source: 'payroll',
          uploadedBy: userId || 'manager',
          createdAt: FieldValue.serverTimestamp(),
        });

        // Update member shares balance & loan limit
        const currentShares = Number(memberData.currentSharesBalance) || 0;
        const totalContributed = Number(memberData.totalSharesContributed) || 0;
        const newShares = currentShares + shares;
        const newTotalContributed = totalContributed + shares;
        const newLoanLimit = newShares * 3;

        firestoreBatch.update(memberDoc.ref, {
          currentSharesBalance: newShares,
          totalSharesContributed: newTotalContributed,
          loanLimit: newLoanLimit,
          updatedAt: FieldValue.serverTimestamp(),
        });

        batchResult.successCount++;
      }

      // Record comprehensive audit log for deduction upload
      firestoreBatch.set(auditLogRef, {
        logId: auditLogRef.id,
        userId: userId || 'system_manager',
        action: 'PROCESS_MONTHLY_DEDUCTIONS_UPLOAD',
        collection: 'deductions',
        documentId: 'batch_upload_' + Date.now(),
        oldValue: null,
        newValue: { successCount: batchResult.successCount, monthYear: monthYear || 'October 2026' },
        timestamp: FieldValue.serverTimestamp(),
      });

      await firestoreBatch.commit();

      return res.json({
        success: true,
        message: `Successfully processed ${batchResult.successCount} deduction records.`,
        errors: batchResult.errors,
      });

    } catch (error: any) {
      console.error('Error processing deduction upload:', error);
      return res.status(500).json({ error: error.message || 'Internal server error during deduction processing.' });
    }
  });

  // API Route: Comprehensive Audit Logging
  app.post('/api/audit-log', async (req, res) => {
    try {
      const { userId, action, collectionName, documentId, oldValue, newValue } = req.body;
      if (!db) {
        return res.status(500).json({ error: 'Database not initialized.' });
      }

      const logRef = db.collection('auditLogs').doc();
      await logRef.set({
        logId: logRef.id,
        userId: userId || 'system',
        action: action || 'GENERAL_ACTION',
        collection: collectionName || 'general',
        documentId: documentId || 'N/A',
        oldValue: oldValue || null,
        newValue: newValue || null,
        timestamp: FieldValue.serverTimestamp(),
      });

      return res.json({ success: true, logId: logRef.id });
    } catch (error: any) {
      console.error('Error creating audit log:', error);
      return res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`Urigiti Sacco Server running on port ${port}`);
  });
}

startServer();
