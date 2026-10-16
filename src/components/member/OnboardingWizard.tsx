import React, { useState } from 'react';
import { UserCheck, FileText, Upload, CheckCircle2, ShieldCheck, ArrowRight, ArrowLeft, AlertCircle, X } from 'lucide-react';
import { db } from '../../firebase/config';
import { doc, setDoc } from 'firebase/firestore';
import { Member } from '../../types';

interface OnboardingWizardProps {
  member: Member;
  onComplete: () => void;
  onCancel?: () => void;
}

export function OnboardingWizard({ member, onComplete, onCancel }: OnboardingWizardProps) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    fullName: member.fullName || '',
    employeeNumber: member.employeeNumber || '',
    phone: member.phone || '',
    department: 'PCEA Tumutumu Nursing & Clinical',
    idNumber: '',
    nextOfKin: '',
    nextOfKinPhone: '',
    signature: '',
    agreedToTerms: false,
  });
  const [idFileUploaded, setIdFileUploaded] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleNext = (e: React.FormEvent) => {
    e.preventDefault();
    if (step < 4) {
      setStep(step + 1);
    } else {
      handleSubmitOnboarding();
    }
  };

  const handleSubmitOnboarding = async () => {
    try {
      setSubmitting(true);
      setError('');
      await setDoc(doc(db, 'members', member.memberId), {
        memberId: member.memberId,
        email: member.email || '',
        fullName: formData.fullName,
        employeeNumber: formData.employeeNumber,
        phone: formData.phone,
        department: formData.department,
        onboardingCompleted: true,
        onboardingStatus: 'pending_admin_review',
        idNumber: formData.idNumber,
        nextOfKin: formData.nextOfKin,
        nextOfKinPhone: formData.nextOfKinPhone,
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      // Record audit log via backend API
      fetch('/api/audit-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: member.email || member.memberId,
          action: 'SUBMIT_MEMBER_ONBOARDING',
          collectionName: 'members',
          documentId: member.memberId,
          newValue: {
            fullName: formData.fullName,
            employeeNumber: formData.employeeNumber,
            idNumber: formData.idNumber,
            onboardingStatus: 'pending_admin_review',
          },
        }),
      }).catch(console.error);

      onComplete();
    } catch (err: any) {
      console.error('Error submitting onboarding:', err);
      setError(err?.message || 'Failed to submit onboarding profile. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2 bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full text-xs font-semibold w-fit mb-1">
              <ShieldCheck className="w-3.5 h-3.5" /> PCEA Tumutumu Hospital Sacco Onboarding
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900">New Member Onboarding Wizard</h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold bg-slate-100 text-slate-600 px-3 py-1 rounded-full">Step {step} of 4</span>
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-xl hover:bg-slate-100 transition"
                title="Cancel and close onboarding"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
          <div
            className="bg-emerald-600 h-full transition-all duration-300"
            style={{ width: `${(step / 4) * 100}%` }}
          />
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleNext} className="space-y-5">
          {/* Step 1: Profile Information */}
          {step === 1 && (
            <div className="space-y-4 animate-fadeIn">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-emerald-600" /> 1. Complete Profile Information
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Full Name (As per ID)</label>
                  <input
                    type="text"
                    required
                    value={formData.fullName}
                    onChange={e => setFormData({ ...formData, fullName: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Employee Number</label>
                  <input
                    type="text"
                    required
                    value={formData.employeeNumber}
                    onChange={e => setFormData({ ...formData, employeeNumber: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Phone Number</label>
                  <input
                    type="text"
                    required
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Hospital Department</label>
                  <select
                    value={formData.department}
                    onChange={e => setFormData({ ...formData, department: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm bg-white"
                  >
                    <option value="Nursing">Nursing Department</option>
                    <option value="Clinical Medicine">Clinical Medicine & Doctors</option>
                    <option value="Laboratory">Laboratory & Pharmacy</option>
                    <option value="Finance & Administration">Finance & Administration</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Next of Kin Name</label>
                  <input
                    type="text"
                    required
                    value={formData.nextOfKin}
                    onChange={e => setFormData({ ...formData, nextOfKin: e.target.value })}
                    placeholder="Jane Kamau"
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Next of Kin Phone</label>
                  <input
                    type="text"
                    required
                    value={formData.nextOfKinPhone}
                    onChange={e => setFormData({ ...formData, nextOfKinPhone: e.target.value })}
                    placeholder="+254700000000"
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: National ID & Document Upload */}
          {step === 2 && (
            <div className="space-y-4 animate-fadeIn">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Upload className="w-5 h-5 text-emerald-600" /> 2. Upload National ID & Employment Contract
              </h3>
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">National ID Number</label>
                <input
                  type="text"
                  required
                  value={formData.idNumber}
                  onChange={e => setFormData({ ...formData, idNumber: e.target.value })}
                  placeholder="32456789"
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm"
                />
              </div>

              <div className="border-2 border-dashed border-slate-300 rounded-2xl p-6 text-center space-y-3 bg-slate-50">
                <Upload className="w-8 h-8 text-emerald-600 mx-auto" />
                <div>
                  <p className="font-bold text-slate-800 text-sm">Upload Scanned National ID (Front & Back) & Employment Contract</p>
                  <p className="text-xs text-slate-500">PDF, JPG, or PNG up to 10MB</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIdFileUploaded(true);
                    alert('National ID document successfully attached!');
                  }}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                    idFileUploaded ? 'bg-emerald-600 text-white' : 'bg-slate-900 text-white hover:bg-slate-800'
                  }`}
                >
                  {idFileUploaded ? '✓ Document Uploaded' : 'Browse Files'}
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Membership Agreement */}
          {step === 3 && (
            <div className="space-y-4 animate-fadeIn">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-600" /> 3. Membership Agreement & Digital Signature
              </h3>
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 max-h-48 overflow-y-auto text-xs text-slate-700 space-y-2">
                <p className="font-bold">PCEA TUMUTUMU HOSPITAL URIGITI SACCO BY-LAWS & AGREEMENT</p>
                <p>1. I hereby apply for membership in Urigiti Sacco and agree to conform to the by-laws and amendments thereof.</p>
                <p>2. I authorize PCEA Tumutumu Hospital Finance Department to deduct monthly share contributions and loan repayments from my salary checkoff.</p>
                <p>3. I commit to maintaining active shares contribution as stipulated by the cooperative management.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Digital Signature (Type Full Name)</label>
                <input
                  type="text"
                  required
                  value={formData.signature}
                  onChange={e => setFormData({ ...formData, signature: e.target.value })}
                  placeholder="e.g. Dr. John Kamau"
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm italic font-serif"
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer pt-2">
                <input
                  type="checkbox"
                  required
                  checked={formData.agreedToTerms}
                  onChange={e => setFormData({ ...formData, agreedToTerms: e.target.checked })}
                  className="w-4 h-4 text-emerald-600 rounded border-slate-300"
                />
                <span className="text-xs font-medium text-slate-700">I confirm that all information provided is accurate and agree to the Sacco by-laws.</span>
              </label>
            </div>
          )}

          {/* Step 4: Submission & Review */}
          {step === 4 && (
            <div className="space-y-4 text-center py-6 animate-fadeIn">
              <div className="bg-emerald-100 text-emerald-700 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-2">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h3 className="text-xl font-bold text-slate-900">Ready to Submit for Admin Review</h3>
              <p className="text-sm text-slate-600 max-w-md mx-auto">
                Your onboarding profile, National ID, and signed membership agreement are prepared and ready for system admin and manager verification.
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-between items-center pt-4 border-t border-slate-100">
            <div className="flex items-center gap-2">
              {onCancel && (
                <button
                  type="button"
                  onClick={onCancel}
                  className="px-4 py-2 border border-slate-200 text-slate-600 hover:text-slate-800 rounded-xl text-xs font-semibold hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
              )}
              {step > 1 && (
                <button
                  type="button"
                  onClick={() => setStep(step - 1)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50 flex items-center gap-1.5 transition"
                >
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md flex items-center gap-1.5 disabled:opacity-50 transition"
            >
              {submitting ? 'Submitting...' : step === 4 ? 'Complete Onboarding' : 'Continue'}
              {step < 4 && <ArrowRight className="w-4 h-4" />}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
