// lib/screens/doctor/doctor_profile_details.dart
import 'package:flutter/material.dart';

class DoctorProfileDetails extends StatelessWidget {
  const DoctorProfileDetails({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Profile Details'),
      ),
      body: const Center(
        child: Text('Profile Details Screen'),
      ),
    );
  }
}