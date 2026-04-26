import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Platform, View, Text, ActivityIndicator } from 'react-native';
import React, { Suspense, useEffect, useState } from 'react';
import { colors } from './constants/colors';
import api from './services/apiService';
import UpdateModal from './components/common/UpdateModal';

import * as Notifications from 'expo-notifications';
import { version as APP_VERSION } from './package.json'; // Otomatik versiyon takibi
import { registerBackgroundFetchAsync } from './services/backgroundTaskService';

Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
    }),
});

// Ekranlar
import LoginScreen from './screens/LoginScreen';
import DashboardScreen from './screens/dashboard/DashboardScreen';
import CoursesScreen from './screens/course/CoursesScreen';
import GraduationScreen from './screens/graduation/GraduationScreen';
import RoomsScreen from './screens/rooms/RoomsScreen';
import NinovaScreen from './screens/ninova/NinovaScreen';
import NinovaDetailScreen from './screens/ninova/NinovaDetailScreen';
import NinovaAnnouncementsScreen from './screens/notification/NinovaAnnouncementsScreen';
import NinovaAnnouncementListScreen from './screens/notification/NinovaAnnouncementListScreen';
import CourseDetailScreen from './screens/course/CourseDetailScreen';
import GPASimulatorScreen from './screens/gpa/GPASimulatorScreen';
import NotesScreen from './screens/notes/NotesScreen';
import MenuScreen from './screens/menu/MenuScreen';
import AboutScreen from './screens/about/AboutScreen';
import NotificationsScreen from './screens/notification/NotificationsScreen';
import NotificationDetailScreen from './screens/notification/NotificationDetailScreen';

import GradeDistScreen from './screens/grades/GradeDistScreen';
import GradeDetailScreen from './screens/grades/GradeDetailScreen';
import AttendanceDetailsScreen from './screens/attendance/AttendanceDetailsScreen';

import ScheduleScreen from './screens/schedule/ScheduleScreen';
import PrerequisitesScreen from './screens/prerequisites/PrerequisitesScreen';

// Lazy load RingScreen to handle react-native-maps in Expo Go
const RingScreen = React.lazy(() => import('./screens/ring/RingScreen'));

// Fallback component while loading
const LoadingFallback = () => (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={{ color: colors.muted, marginTop: 16 }}>Yükleniyor...</Text>
    </View>
);

// Wrapper for lazy loaded screens
const RingScreenWrapper = (props) => (
    <Suspense fallback={<LoadingFallback />}>
        <RingScreen {...props} />
    </Suspense>
);

const Stack = createNativeStackNavigator();

export default function App() {
    const [updateInfo, setUpdateInfo] = useState({ visible: false, latestVersion: '', changelog: '' });

    useEffect(() => {
        const checkAppUpdate = async () => {
            const res = await api.checkUpdate(APP_VERSION);

            if (res && res.hasUpdate) {
                setUpdateInfo({
                    visible: true,
                    latestVersion: res.latestVersion,
                    changelog: res.changelog
                });
            }
        };

        const setupNotificationsAndBackgroundFetch = async () => {
            try {
                const { status: existingStatus } = await Notifications.getPermissionsAsync();
                let finalStatus = existingStatus;

                if (existingStatus !== 'granted') {
                    const { status } = await Notifications.requestPermissionsAsync();
                    finalStatus = status;
                }

                if (finalStatus === 'granted') {
                    await registerBackgroundFetchAsync();
                    console.log('[App] Bildirim izni verildi ve Arkaplan kancası (BackgroundFetch) takıldı.');
                } else {
                    console.log('[App] Bildirim izni reddedildi. Arkaplan izleme çalışmayacak.');
                }
            } catch (e) {
                console.error('[App] Background Task kurulumunda hata:', e);
            }
        };

        checkAppUpdate();
        setupNotificationsAndBackgroundFetch();
    }, []);

    return (
        <NavigationContainer>
            <StatusBar style="light" />
            <UpdateModal
                visible={updateInfo.visible}
                latestVersion={updateInfo.latestVersion}
                changelog={updateInfo.changelog}
                onClose={() => setUpdateInfo(prev => ({ ...prev, visible: false }))}
            />
            <Stack.Navigator
                initialRouteName="Login"
                screenOptions={{
                    headerShown: false,
                    contentStyle: { backgroundColor: colors.bg },
                    animation: Platform.OS === 'ios' ? 'slide_from_right' : 'simple_push',
                }}
            >
                <Stack.Screen name="Login" component={LoginScreen} />
                <Stack.Screen name="Dashboard" component={DashboardScreen} />
                <Stack.Screen name="Courses" component={CoursesScreen} />
                <Stack.Screen name="Graduation" component={GraduationScreen} />
                <Stack.Screen name="Rooms" component={RoomsScreen} />
                <Stack.Screen name="Ninova" component={NinovaScreen} />
                <Stack.Screen name="NinovaDetail" component={NinovaDetailScreen} />
                <Stack.Screen name="NinovaAnnouncements" component={NinovaAnnouncementsScreen} />
                <Stack.Screen name="NinovaAnnouncementList" component={NinovaAnnouncementListScreen} />
                <Stack.Screen name="CourseDetail" component={CourseDetailScreen} />
                <Stack.Screen name="GPASimulator" component={GPASimulatorScreen} />
                <Stack.Screen name="Notes" component={NotesScreen} />
                <Stack.Screen name="Ring" component={RingScreenWrapper} />
                <Stack.Screen name="Menu" component={MenuScreen} />
                <Stack.Screen name="About" component={AboutScreen} />
                <Stack.Screen name="Notifications" component={NotificationsScreen} />
                <Stack.Screen name="NotificationDetail" component={NotificationDetailScreen} />

                <Stack.Screen name="GradeDist" component={GradeDistScreen} />
                <Stack.Screen name="GradeDetail" component={GradeDetailScreen} />
                <Stack.Screen name="AttendanceDetails" component={AttendanceDetailsScreen} />

                <Stack.Screen name="Schedule" component={ScheduleScreen} />
                <Stack.Screen name="Prerequisites" component={PrerequisitesScreen} />
            </Stack.Navigator>
        </NavigationContainer>
    );
}
