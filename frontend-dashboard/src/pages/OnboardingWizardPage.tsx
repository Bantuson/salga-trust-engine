/**
 * Onboarding Wizard Page
 *
 * Multi-step guided setup for new municipalities.
 * Steps: Welcome → Profile → Team → Wards → SLA → Completion
 * Progress persisted to backend (GET/PUT /api/v1/onboarding/state).
 * LocalStorage as fallback cache for offline resilience.
 */

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatedGradientBg } from '@shared/components/AnimatedGradientBg';
import { GlassCard } from '@shared/components/ui/GlassCard';
import { Button } from '@shared/components/ui/Button';
import { useAuth } from '../hooks/useAuth';
import { useOnboarding } from '../hooks/useOnboarding';
import { WizardProgress } from '../components/onboarding/WizardProgress';
import type { WizardStep } from '../components/onboarding/WizardProgress';
import { WelcomeStep } from '../components/onboarding/WelcomeStep';
import { ProfileStep } from '../components/onboarding/ProfileStep';
import type { ProfileData } from '../components/onboarding/ProfileStep';
import { InviteTeamStep } from '../components/onboarding/InviteTeamStep';
import type { InviteTeamData, TeamInvitation } from '../components/onboarding/InviteTeamStep';
import { ConfigureWardsStep } from '../components/onboarding/ConfigureWardsStep';
import type { ConfigureWardsData } from '../components/onboarding/ConfigureWardsStep';
import { SetSLAStep } from '../components/onboarding/SetSLAStep';
import type { SLAData } from '../components/onboarding/SetSLAStep';
import { CompletionStep } from '../components/onboarding/CompletionStep';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

const STORAGE_KEY = 'salga_onboarding_wizard_data';

const STEPS: WizardStep[] = [
  { id: 'welcome', title: 'Welcome', isCompleted: false, isCurrent: true },
  { id: 'profile', title: 'Profile', isCompleted: false, isCurrent: false },
  { id: 'team', title: 'Team', isCompleted: false, isCurrent: false },
  { id: 'wards', title: 'Wards', isCompleted: false, isCurrent: false },
  { id: 'sla', title: 'SLA', isCompleted: false, isCurrent: false },
  { id: 'complete', title: 'Done', isCompleted: false, isCurrent: false },
];

interface WizardData {
  profile?: ProfileData;
  team?: InviteTeamData;
  wards?: ConfigureWardsData;
  sla?: SLAData;
}

export function OnboardingWizardPage() {
  const navigate = useNavigate();
  const { getAccessToken, getTenantId } = useAuth();
  const { loadProgress, saveStep, completeOnboarding, isLoading, error } = useOnboarding();

  const [currentStep, setCurrentStep] = useState(0);
  const [steps, setSteps] = useState<WizardStep[]>(STEPS);
  const [wizardData, setWizardData] = useState<WizardData>({});
  const [isLoadingProgress, setIsLoadingProgress] = useState(true);

  const containerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // Load progress from backend on mount
  useEffect(() => {
    const loadInitialProgress = async () => {
      setIsLoadingProgress(true);

      // Try loading from backend
      const backendProgress = await loadProgress();

      if (backendProgress && backendProgress.steps.length > 0) {
        // Resume from backend state
        const updatedSteps = [...STEPS];
        const loadedData: WizardData = {};

        backendProgress.steps.forEach((savedStep) => {
          const stepIndex = updatedSteps.findIndex((s) => s.id === savedStep.step_id);
          if (stepIndex >= 0) {
            updatedSteps[stepIndex].isCompleted = savedStep.is_completed;
          }

          // Load step data
          if (savedStep.step_data) {
            if (savedStep.step_id === 'profile') {
              loadedData.profile = savedStep.step_data as ProfileData;
            } else if (savedStep.step_id === 'team') {
              loadedData.team = savedStep.step_data as InviteTeamData;
            } else if (savedStep.step_id === 'wards') {
              loadedData.wards = savedStep.step_data as ConfigureWardsData;
            } else if (savedStep.step_id === 'sla') {
              loadedData.sla = savedStep.step_data as SLAData;
            }
          }
        });

        setSteps(updatedSteps);
        setWizardData(loadedData);

        // Resume from first incomplete step (skip welcome if any other step completed)
        const firstIncompleteIndex = updatedSteps.findIndex((s) => !s.isCompleted && s.id !== 'welcome');
        if (firstIncompleteIndex >= 0) {
          setCurrentStep(firstIncompleteIndex);
        }
      } else {
        // Fallback to localStorage
        const cachedData = localStorage.getItem(STORAGE_KEY);
        if (cachedData) {
          try {
            const parsed = JSON.parse(cachedData);
            setWizardData(parsed.data || {});
            setCurrentStep(parsed.step || 0);
          } catch (err) {
            console.error('Failed to parse cached wizard data:', err);
          }
        }
      }

      setIsLoadingProgress(false);
    };

    loadInitialProgress();
  }, [loadProgress]);

  // Auto-save to localStorage as cache
  useEffect(() => {
    if (!isLoadingProgress && currentStep > 0) {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ step: currentStep, data: wizardData })
      );
    }
  }, [currentStep, wizardData, isLoadingProgress]);

  // Entrance animation
  useGSAP(
    () => {
      if (isLoadingProgress) return;

      gsap.from(cardRef.current, {
        y: 30,
        opacity: 0,
        duration: 0.6,
        ease: 'power2.out',
      });
    },
    { scope: containerRef, dependencies: [isLoadingProgress] }
  );

  const handleNext = async () => {
    // Save current step to backend before advancing
    const stepId = steps[currentStep].id;

    if (stepId !== 'welcome' && stepId !== 'complete') {
      let stepData = null;
      let isCompleted = true;

      if (stepId === 'profile') {
        stepData = wizardData.profile || null;
      } else if (stepId === 'team') {
        stepData = wizardData.team || null;
      } else if (stepId === 'wards') {
        stepData = wizardData.wards || null;
      } else if (stepId === 'sla') {
        stepData = wizardData.sla || null;
      }

      await saveStep(stepId, stepData, isCompleted);

      // Mark step as completed
      const updatedSteps = [...steps];
      updatedSteps[currentStep].isCompleted = true;
      setSteps(updatedSteps);
    }

    // Advance to next step
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = async () => {
    // Save as not completed, then advance
    const stepId = steps[currentStep].id;

    if (stepId !== 'welcome' && stepId !== 'complete' && stepId !== 'profile') {
      await saveStep(stepId, null, false);
    }

    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleProfileChange = (data: ProfileData) => {
    setWizardData({ ...wizardData, profile: data });
  };

  const handleTeamChange = (data: InviteTeamData) => {
    setWizardData({ ...wizardData, team: data });
  };

  const handleSubmitInvitations = async (invitations: TeamInvitation[]) => {
    const token = getAccessToken();
    const tenantId = getTenantId();

    if (!token || !tenantId) {
      throw new Error('User not authenticated');
    }

    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';

    const response = await fetch(`${apiUrl}/api/v1/invitations/bulk`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Tenant-ID': tenantId,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        invitations: invitations.map((inv) => ({
          email: inv.email,
          role: inv.role,
        })),
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to send invitations');
    }

    return response.json();
  };

  const handleWardsChange = (data: ConfigureWardsData) => {
    setWizardData({ ...wizardData, wards: data });
  };

  const handleSLAChange = (data: SLAData) => {
    setWizardData({ ...wizardData, sla: data });
  };

  const handleComplete = async (): Promise<boolean> => {
    const success = await completeOnboarding();
    if (success) {
      localStorage.removeItem(STORAGE_KEY);
    }
    return success;
  };

  const handleNavigateDashboard = () => {
    navigate('/');
  };

  // Validation for "Next" button
  const canProceed = (): boolean => {
    const stepId = steps[currentStep].id;

    if (stepId === 'profile') {
      const profile = wizardData.profile;
      return !!(
        profile &&
        profile.municipalityName &&
        profile.municipalityCode &&
        profile.province &&
        profile.contactEmail &&
        profile.contactPhone &&
        profile.contactPersonName
      );
    }

    return true; // Other steps are skippable or don't require validation
  };

  // Show skippable steps
  const isSkippable = (): boolean => {
    const stepId = steps[currentStep].id;
    return stepId === 'team' || stepId === 'wards' || stepId === 'sla';
  };

  if (isLoadingProgress) {
    return (
      <div style={styles.loadingContainer}>
        <AnimatedGradientBg />
        <div style={styles.spinner}></div>
        <p style={styles.loadingText}>Loading your progress...</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} style={styles.container}>
      <AnimatedGradientBg />

      <div ref={cardRef}>
        <GlassCard style={styles.card}>
        {/* Progress indicator (hide on welcome and completion) */}
        {currentStep > 0 && currentStep < steps.length - 1 && (
          <WizardProgress
            steps={steps.slice(1, -1)} // Exclude welcome and completion
            currentStepIndex={currentStep - 1}
          />
        )}

        {/* Step content */}
        <div style={styles.stepContent}>
          {currentStep === 0 && <WelcomeStep onStart={() => setCurrentStep(1)} />}
          {currentStep === 1 && (
            <ProfileStep initialData={wizardData.profile} onDataChange={handleProfileChange} />
          )}
          {currentStep === 2 && (
            <InviteTeamStep
              initialData={wizardData.team}
              onDataChange={handleTeamChange}
              onSubmitInvitations={handleSubmitInvitations}
            />
          )}
          {currentStep === 3 && (
            <ConfigureWardsStep initialData={wizardData.wards} onDataChange={handleWardsChange} />
          )}
          {currentStep === 4 && (
            <SetSLAStep initialData={wizardData.sla} onDataChange={handleSLAChange} />
          )}
          {currentStep === 5 && (
            <CompletionStep
              onComplete={handleComplete}
              onNavigateDashboard={handleNavigateDashboard}
              summary={{
                municipalityName: wizardData.profile?.municipalityName,
                municipalityCode: wizardData.profile?.municipalityCode,
                teamMembersCount: wizardData.team?.invitations?.filter((i) => i.email).length || 0,
                wardsCount: wizardData.wards?.wards?.filter((w) => w.name).length || 0,
                slaConfigured: !!wizardData.sla,
              }}
            />
          )}
        </div>

        {/* Navigation buttons (hide on welcome and completion) */}
        {currentStep > 0 && currentStep < steps.length - 1 && (
          <div style={styles.navigation}>
            <Button variant="ghost" onClick={handleBack} disabled={isLoading}>
              Back
            </Button>

            <div style={styles.rightButtons}>
              {isSkippable() && (
                <Button variant="ghost" onClick={handleSkip} disabled={isLoading}>
                  Skip
                </Button>
              )}

              <Button
                variant="primary"
                onClick={handleNext}
                disabled={!canProceed() || isLoading}
                loading={isLoading}
              >
                {currentStep === steps.length - 2 ? 'Finish' : 'Next'}
              </Button>
            </div>
          </div>
        )}

        {error && <div style={styles.errorBox}>{error}</div>}
        </GlassCard>
      </div>
    </div>
  );
}

const styles = {
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    gap: '1rem',
    position: 'relative' as const,
  } as React.CSSProperties,
  spinner: {
    width: '40px',
    height: '40px',
    border: '4px solid var(--surface-higher)',
    borderTop: '4px solid var(--color-teal)',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    position: 'relative' as const,
    zIndex: 10,
  } as React.CSSProperties,
  loadingText: {
    fontSize: '1rem',
    color: 'var(--text-secondary)',
    position: 'relative' as const,
    zIndex: 10,
  } as React.CSSProperties,
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem',
    position: 'relative' as const,
    overflow: 'hidden',
  } as React.CSSProperties,
  card: {
    width: '100%',
    maxWidth: '900px',
    padding: '3rem 2.5rem',
    position: 'relative' as const,
    zIndex: 10,
  } as React.CSSProperties,
  stepContent: {
    marginBottom: '2rem',
    minHeight: '400px',
  } as React.CSSProperties,
  navigation: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '1rem',
    paddingTop: '2rem',
    borderTop: '1px solid var(--border-subtle)',
  } as React.CSSProperties,
  rightButtons: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
  } as React.CSSProperties,
  errorBox: {
    padding: '0.75rem',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid var(--color-coral)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--color-coral)',
    marginTop: '1rem',
    fontSize: '0.875rem',
  } as React.CSSProperties,
};
