import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import { patientApi, doctorApi, shopApi } from '../../api/client';
import { UserRole } from '@rxdesk/shared';

interface Field { key: string; label: string; placeholder: string; keyboardType?: 'default' | 'number-pad' | 'email-address' | 'numeric'; multiline?: boolean; }

const PATIENT_FIELDS: Field[] = [
  { key: 'full_name', label: 'Full Name', placeholder: 'Enter your full name' },
  { key: 'age', label: 'Age', placeholder: 'Your age', keyboardType: 'number-pad' },
  { key: 'blood_group', label: 'Blood Group', placeholder: 'e.g. B+' },
  { key: 'address_line', label: 'Address', placeholder: 'Your address', multiline: true },
];

const DOCTOR_FIELDS: Field[] = [
  { key: 'full_name', label: 'Full Name', placeholder: 'Dr. Your Name' },
  { key: 'specialization', label: 'Specialization', placeholder: 'e.g. General Physician' },
  { key: 'mci_number', label: 'MCI Registration No.', placeholder: 'Medical Council number' },
  { key: 'experience_years', label: 'Years of Experience', placeholder: '0', keyboardType: 'number-pad' },
  { key: 'qualifications', label: 'Qualifications', placeholder: 'e.g. MBBS, MD (comma separated)' },
];

const SHOP_FIELDS: Field[] = [
  { key: 'shop_name', label: 'Shop Name', placeholder: 'Your Medical Shop Name' },
  { key: 'drug_license_no', label: 'Drug License Number', placeholder: 'DL-XXXXX' },
  { key: 'address_line', label: 'Address', placeholder: 'Full shop address', multiline: true },
  { key: 'city', label: 'City', placeholder: 'City name' },
  { key: 'state', label: 'State', placeholder: 'State' },
  { key: 'pin_code', label: 'PIN Code', placeholder: '6-digit PIN code', keyboardType: 'number-pad' },
  { key: 'contact_phone', label: 'Shop Phone (10 digits)', placeholder: '10-digit number', keyboardType: 'number-pad' },
];

function getFieldsForRole(role: UserRole): Field[] {
  switch (role) {
    case 'patient': return PATIENT_FIELDS;
    case 'doctor': return DOCTOR_FIELDS;
    case 'shop_owner': return SHOP_FIELDS;
    default: return [];
  }
}

export default function SetupProfileScreen() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [form, setForm] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const role = user?.role as UserRole;
  const fields = getFieldsForRole(role);

  const handleSubmit = async () => {
    // Basic validation — check required fields are non-empty
    for (const f of fields) {
      if (!form[f.key] && !f.multiline) {
        Alert.alert('Missing Field', `Please fill in: ${f.label}`);
        return;
      }
    }

    setLoading(true);
    try {
      const payload: Record<string, unknown> = { ...form };
      // Coerce numeric fields
      if (role === 'patient') payload.age = Number(form.age);
      if (role === 'doctor') {
        payload.experience_years = Number(form.experience_years);
        // qualifications must be an array
        payload.qualifications = (form.qualifications ?? '')
          .split(',')
          .map((q) => q.trim())
          .filter(Boolean);
      }
      if (role === 'shop_owner') {
        // contact_phone must be +91XXXXXXXXXX
        const raw = form.contact_phone?.replace(/\D/g, '');
        payload.contact_phone = raw?.startsWith('91') ? `+${raw}` : `+91${raw}`;
      }

      if (role === 'patient') await patientApi.updateProfile(payload);
      else if (role === 'doctor') await doctorApi.createProfile(payload);
      else if (role === 'shop_owner') await shopApi.register(payload);

      // Mark profile as complete so RootGuard allows navigation out of auth group
      const { user: currentUser } = useAuthStore.getState();
      if (currentUser) {
        await useAuthStore.getState().setUser({ ...currentUser, is_profile_complete: true });
      }

      const dest = role === 'patient' ? '/(patient)' : role === 'doctor' ? '/(doctor)' : '/(shop)';
      router.replace(dest as any);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.error?.message ?? 'Failed to save profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const roleTitle = role === 'patient' ? 'Patient Profile' : role === 'doctor' ? 'Doctor Profile' : 'Shop Profile';
  const roleColor = role === 'patient' ? 'bg-sky-500' : role === 'doctor' ? 'bg-emerald-500' : 'bg-violet-500';
  const btnColor = role === 'patient' ? 'bg-sky-500' : role === 'doctor' ? 'bg-emerald-500' : 'bg-violet-500';

  return (
    <KeyboardAvoidingView className="flex-1 bg-white" behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View className={`${roleColor} px-6 pt-12 pb-6`}>
        <Text className="text-white text-2xl font-bold">Set Up {roleTitle}</Text>
        <Text className="text-white/70 mt-1 text-sm">Fill in your details to get started</Text>
      </View>

      <ScrollView className="flex-1 px-6 pt-6" showsVerticalScrollIndicator={false}>
        {fields.map((field) => (
          <View key={field.key} className="mb-4">
            <Text className="text-sm font-medium text-gray-700 mb-1.5">{field.label}</Text>
            <TextInput
              className={`border border-gray-200 rounded-xl px-4 text-gray-900 text-base focus:border-sky-400 ${field.multiline ? 'h-20 pt-2' : 'h-12'}`}
              placeholder={field.placeholder}
              placeholderTextColor="#9CA3AF"
              keyboardType={field.keyboardType ?? 'default'}
              multiline={field.multiline}
              value={form[field.key] ?? ''}
              onChangeText={(v) => setForm({ ...form, [field.key]: v })}
            />
          </View>
        ))}

        <TouchableOpacity
          className={`${btnColor} h-14 rounded-xl items-center justify-center mt-4 mb-8`}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color="white" /> : <Text className="text-white font-semibold text-base">Save & Continue →</Text>}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
