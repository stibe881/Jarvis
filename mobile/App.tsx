import { StatusBar } from "expo-status-bar";
import { StyleSheet, SafeAreaView } from "react-native";
import { WebView } from "react-native-webview";

export default function App() {
  // TODO: Hier musst du die echte URL deines Hetzner-Servers eintragen (z.B. https://jarvis.deine-domain.ch)
  // Ohne diese korrekte URL kann sich die App nicht mit deinem Server verbinden!
  const webAppUrl = "https://BITTE-HIER-DEINE-ECHTE-URL-EINTRAGEN.com";

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
