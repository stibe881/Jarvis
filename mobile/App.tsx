import { StatusBar } from "expo-status-bar";
import { StyleSheet, SafeAreaView } from "react-native";
import { WebView } from "react-native-webview";

export default function App() {
  // TODO: Replace with the actual URL of your hosted web app
  const webAppUrl = "https://deine-web-app-url.com";

  return (
    <SafeAreaView style={styles.container}>
      <WebView
        source={{ uri: webAppUrl }}
        style={styles.webview}
        allowsBackForwardNavigationGestures={true}
      />
      <StatusBar style="auto" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  webview: {
    flex: 1,
  },
});
