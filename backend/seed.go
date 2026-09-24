package main

import (
	"context"
	"database/sql"
	"os"
	"path/filepath"
	"strings"
)

func seed(ctx context.Context, db *sql.DB, attachmentDir string) error {
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()
	if _, err = tx.ExecContext(ctx, `TRUNCATE attachments, article_contributors, article_skills, articles, employee_skills, employees, skills RESTART IDENTITY CASCADE`); err != nil {
		return err
	}
	employees := []Employee{
		{Name: "Anna Keller", Email: "anna.keller@example.com", Department: "Digital Solutions", Skills: []Skill{{Name: "python", Rating: 9}, {Name: "postgresql", Rating: 8}, {Name: "genai", Rating: 7}}},
		{Name: "Mehmet Yilmaz", Email: "mehmet.yilmaz@example.com", Department: "Production", Skills: []Skill{{Name: "sap-pm", Rating: 9}, {Name: "arbeitssicherheit", Rating: 9}, {Name: "lean", Rating: 8}}},
		{Name: "Sofia Marin", Email: "sofia.marin@example.com", Department: "Data & AI", Skills: []Skill{{Name: "python", Rating: 10}, {Name: "machine-learning", Rating: 9}, {Name: "data-quality", Rating: 8}}},
		{Name: "Jonas Richter", Email: "jonas.richter@example.com", Department: "Cloud Platform", Skills: []Skill{{Name: "kubernetes", Rating: 9}, {Name: "observability", Rating: 8}, {Name: "linux", Rating: 9}}},
		{Name: "Lea Hoffmann", Email: "lea.hoffmann@example.com", Department: "Sustainability", Skills: []Skill{{Name: "power-bi", Rating: 9}, {Name: "sustainability", Rating: 10}, {Name: "sql", Rating: 8}}},
		{Name: "Daniel Okafor", Email: "daniel.okafor@example.com", Department: "Procurement", Skills: []Skill{{Name: "sap-ariba", Rating: 9}, {Name: "procurement", Rating: 9}, {Name: "negotiation", Rating: 8}}},
		{Name: "Priya Nair", Email: "priya.nair@example.com", Department: "Quality Management", Skills: []Skill{{Name: "sap-s4", Rating: 8}, {Name: "quality-management", Rating: 10}, {Name: "data-quality", Rating: 9}}},
		{Name: "Lucas Ferreira", Email: "lucas.ferreira@example.com", Department: "Process Engineering", Skills: []Skill{{Name: "process-engineering", Rating: 9}, {Name: "predictive-maintenance", Rating: 8}, {Name: "python", Rating: 7}}},
		{Name: "Amira Haddad", Email: "amira.haddad@example.com", Department: "People & Culture", Skills: []Skill{{Name: "change-management", Rating: 9}, {Name: "facilitation", Rating: 9}, {Name: "knowledge-management", Rating: 8}}},
		{Name: "Felix Braun", Email: "felix.braun@example.com", Department: "SAP Platform", Skills: []Skill{{Name: "sap-s4", Rating: 10}, {Name: "abap", Rating: 9}, {Name: "integration", Rating: 8}}},
		{Name: "Mei Lin", Email: "mei.lin@example.com", Department: "Cyber Security", Skills: []Skill{{Name: "cybersecurity", Rating: 10}, {Name: "incident-response", Rating: 9}, {Name: "linux", Rating: 8}}},
		{Name: "Tobias Schneider", Email: "tobias.schneider@example.com", Department: "Developer Experience", Skills: []Skill{{Name: "git", Rating: 10}, {Name: "ci/cd", Rating: 9}, {Name: "go", Rating: 8}}},
		{Name: "Elena Petrova", Email: "elena.petrova@example.com", Department: "Research & Development", Skills: []Skill{{Name: "chemistry", Rating: 10}, {Name: "laboratory", Rating: 9}, {Name: "knowledge-management", Rating: 7}}},
		{Name: "Noah Williams", Email: "noah.williams@example.com", Department: "Site Operations", Skills: []Skill{{Name: "lean", Rating: 9}, {Name: "arbeitssicherheit", Rating: 10}, {Name: "sap-pm", Rating: 8}}},
		{Name: "Fatima Zahra", Email: "fatima.zahra@example.com", Department: "Supply Chain", Skills: []Skill{{Name: "supply-chain", Rating: 9}, {Name: "sap-s4", Rating: 8}, {Name: "analytics", Rating: 8}}},
		{Name: "Oliver Schmidt", Email: "oliver.schmidt@example.com", Department: "Controlling", Skills: []Skill{{Name: "power-bi", Rating: 8}, {Name: "sql", Rating: 9}, {Name: "finance", Rating: 9}}},
		{Name: "Camila Santos", Email: "camila.santos@example.com", Department: "Customer Solutions", Skills: []Skill{{Name: "crm", Rating: 9}, {Name: "formulation", Rating: 8}, {Name: "facilitation", Rating: 7}}},
		{Name: "Kenji Sato", Email: "kenji.sato@example.com", Department: "Automation", Skills: []Skill{{Name: "industrial-iot", Rating: 9}, {Name: "integration", Rating: 8}, {Name: "predictive-maintenance", Rating: 9}}},
		{Name: "Sarah Müller", Email: "sarah.mueller@example.com", Department: "Data Governance", Skills: []Skill{{Name: "data-governance", Rating: 10}, {Name: "data-quality", Rating: 9}, {Name: "data-mesh", Rating: 8}}},
		{Name: "Ravi Kumar", Email: "ravi.kumar@example.com", Department: "Enterprise Architecture", Skills: []Skill{{Name: "integration", Rating: 9}, {Name: "cloud", Rating: 8}, {Name: "data-mesh", Rating: 9}}},
	}
	for _, employee := range employees {
		var id int64
		if err = tx.QueryRowContext(ctx, `INSERT INTO employees (name, email, department) VALUES ($1, $2, $3) RETURNING id`, employee.Name, employee.Email, employee.Department).Scan(&id); err != nil {
			return err
		}
		if err = saveSkills(ctx, tx, id, employee.Skills); err != nil {
			return err
		}
	}
	articles := []ArticleInput{
		{Title: "Geplanten Anlagenstillstand koordinieren", Description: "Praxisleitfaden für eine sichere und transparente Stillstandsübergabe.", Content: "# Ziel\n\nStillstände werden mit klaren Verantwortlichkeiten, Freigaben und Rückfalloptionen durchgeführt.\n\n## Vor dem Stillstand\n\n1. Arbeitsfreigaben und Gefährdungsbeurteilung prüfen\n2. Aufträge in SAP PM priorisieren\n3. Schichtübergabe und Ersatzteile bestätigen\n\n## Wiederanlauf\n\nVier-Augen-Prüfung durchführen, Abweichungen dokumentieren und Kennzahlen im Shopfloor-Board aktualisieren.", Skills: []string{"sap-pm", "arbeitssicherheit", "lean"}, ContributorIDs: []int64{2, 14}},
		{Title: "PostgreSQL nach einem Produktionsausfall wiederherstellen", Description: "Getesteter Ablauf vom Incident bis zur fachlichen Freigabe der Datenbank.", Content: "# Wiederherstellung\n\n1. Incident-Kanal eröffnen und Schreibzugriffe stoppen\n2. Letztes valides Backup und WAL-Kette prüfen\n3. Restore in isolierter Umgebung ausführen\n4. Integritätsabfragen und Stichproben durchführen\n5. Service kontrolliert freigeben\n\nAlle Zeitpunkte und Entscheidungen werden im Incident-Protokoll festgehalten.", Skills: []string{"postgresql", "python", "incident-response"}, ContributorIDs: []int64{1, 3, 11}},
		{Title: "Materialstammdaten vor dem S/4-Import prüfen", Description: "Qualitätsregeln für konsistente Materialstämme vor einer Migration.", Content: "# Mindestprüfungen\n\n- Pflichtfelder und Mengeneinheiten sind vollständig\n- Materialgruppen entsprechen dem Zielkatalog\n- Dubletten wurden fachlich bewertet\n- Werke, Dispositionsmerkmale und Qualitätsansichten sind gültig\n\nFehler werden nach Kritikalität klassifiziert und erst nach dokumentierter Korrektur erneut importiert.", Skills: []string{"sap-s4", "data-quality", "quality-management"}, ContributorIDs: []int64{7, 10, 19}},
		{Title: "Energieverbrauch im Power-BI-Dashboard erklären", Description: "Definitionen und Prüfregeln für ein gemeinsames Energie-Monitoring.", Content: "# Kennzahlen\n\nDas Dashboard zeigt Strom, Dampf und Gas je Standort, Anlage und Produktionsmenge.\n\n## Plausibilisierung\n\nMonatswerte werden gegen Zählerstände geprüft. Fehlende Messpunkte sind sichtbar zu markieren und dürfen nicht stillschweigend als null interpretiert werden. Standortvergleiche verwenden normalisierte Produktionsmengen.", Skills: []string{"power-bi", "sustainability", "sql"}, ContributorIDs: []int64{5, 16}},
		{Title: "Generative AI verantwortungsvoll pilotieren", Description: "Kompakte Prüfschritte für sichere GenAI-Piloten mit Unternehmensdaten.", Content: "# Vor dem Pilot\n\n1. Geschäftsnutzen und messbares Erfolgskriterium benennen\n2. Datenklassifizierung und zulässige Eingaben klären\n3. Menschliche Prüfung der Ergebnisse festlegen\n4. Risiken, Grenzen und Abbruchkriterien dokumentieren\n\nPersonenbezogene, vertrauliche oder exportkontrollierte Daten dürfen nur in freigegebenen Systemen verarbeitet werden.", Skills: []string{"genai", "data-governance", "data-quality"}, ContributorIDs: []int64{1, 3, 19}},
		{Title: "Kleine Softwareänderungen sicher ausliefern", Description: "Ein schlanker Git- und CI/CD-Ablauf für nachvollziehbare Releases.", Content: "# Ablauf\n\n- Branch vom aktuellen Hauptzweig erstellen\n- Änderung mit einem fokussierten Test absichern\n- Linting, Tests und Build lokal ausführen\n- Pull Request mit Risiko und Rückfallweg beschreiben\n- Nach Freigabe deployen und Kernfunktion prüfen\n\nGroße Änderungen werden in unabhängig auslieferbare Schritte zerlegt.", Skills: []string{"git", "ci/cd", "go"}, ContributorIDs: []int64{12, 20}},
		{Title: "Neue Mitarbeitende sicher ins Labor einarbeiten", Description: "Onboarding-Checkliste für Laborzugang, Unterweisung und dokumentierte Freigabe.", Content: "# Vor dem ersten Versuch\n\nNeue Mitarbeitende absolvieren Standort-, Labor- und tätigkeitsbezogene Unterweisungen. Schutzmaßnahmen, Abfallwege und Notfallkontakte werden praktisch gezeigt.\n\n## Freigabe\n\nDie erste Durchführung erfolgt begleitet. Erst nach dokumentierter Kompetenzbestätigung darf die Tätigkeit selbstständig ausgeführt werden.", Skills: []string{"arbeitssicherheit", "laboratory", "knowledge-management"}, ContributorIDs: []int64{9, 13, 14}},
		{Title: "Lieferantenrisiken in SAP Ariba bewerten", Description: "Einheitliches Vorgehen für Risikoindikatoren und Maßnahmen im Einkauf.", Content: "# Bewertung\n\nFinanzlage, Lieferperformance, Nachhaltigkeit und geografische Abhängigkeiten werden quartalsweise bewertet. Kritische Lieferanten erhalten einen Verantwortlichen und einen terminierten Maßnahmenplan.\n\n## Eskalation\n\nVersorgungsrisiken mit Produktionswirkung werden sofort an Supply Chain und Werkleitung gemeldet.", Skills: []string{"sap-ariba", "procurement", "supply-chain"}, ContributorIDs: []int64{6, 15}},
		{Title: "Predictive Maintenance vom Sensor zum Arbeitsauftrag", Description: "Referenzablauf für belastbare Zustandsmeldungen und SAP-PM-Folgeprozesse.", Content: "# Datenfluss\n\nSensordaten werden auf Vollständigkeit und Zeitstempel geprüft. Das Modell erzeugt nur bei stabiler Datenqualität eine Zustandsmeldung.\n\n## Fachliche Entscheidung\n\nDie Instandhaltung bewertet die Meldung und erzeugt bei Bedarf einen SAP-PM-Auftrag. Modelltreffer und Fehlalarme fließen in die monatliche Nachbewertung ein.", Skills: []string{"predictive-maintenance", "industrial-iot", "python", "sap-pm"}, ContributorIDs: []int64{2, 8, 18}},
		{Title: "Verantwortung für Data Products festlegen", Description: "Rollen und Mindeststandards für auffindbare, verlässliche Datenprodukte.", Content: "# Rollen\n\nDer Data Product Owner verantwortet Nutzen, Qualität und Lebenszyklus. Domain Experts definieren die fachliche Bedeutung, die Plattform stellt den sicheren Betrieb bereit.\n\n## Mindeststandard\n\nJedes Datenprodukt besitzt Beschreibung, Owner, Schema, Qualitätsindikatoren, Zugriffsregeln und einen Supportkanal.", Skills: []string{"data-mesh", "data-governance", "data-quality"}, ContributorIDs: []int64{19, 20}},
		{Title: "Kubernetes-Störung strukturiert bearbeiten", Description: "Incident-Runbook für schnelle Diagnose, Kommunikation und Wiederherstellung.", Content: "# Erste zehn Minuten\n\n1. Auswirkung und betroffene Services bestimmen\n2. Incident Lead und Kommunikationskanal festlegen\n3. Letzte Deployments und Plattformalarme prüfen\n4. Sichere Mitigation wählen\n\nNach der Stabilisierung folgen Ursachenanalyse, konkrete Maßnahmen und ein terminierter Review.", Skills: []string{"kubernetes", "observability", "incident-response", "linux"}, ContributorIDs: []int64{4, 11, 12}},
		{Title: "Formulierungswissen sauber an Customer Solutions übergeben", Description: "Vorlage für reproduzierbare Rezepturübergaben zwischen Labor und Kundenberatung.", Content: "# Übergabepaket\n\nDas Paket enthält Zielanwendung, Rohstoffrollen, Rezepturversion, Herstellreihenfolge, Prüfmethoden und bekannte Grenzen. Abweichungen aus Kundenversuchen werden getrennt von bestätigten Erkenntnissen dokumentiert.\n\n## Abschluss\n\nLabor und Customer Solutions prüfen das Paket gemeinsam und benennen einen Ansprechpartner für Rückfragen.", Skills: []string{"chemistry", "formulation", "knowledge-management"}, ContributorIDs: []int64{9, 13, 17}},
	}
	for _, article := range articles {
		var id int64
		if err = tx.QueryRowContext(ctx, `INSERT INTO articles (title, description, content) VALUES ($1, $2, $3) RETURNING id`, article.Title, article.Description, article.Content).Scan(&id); err != nil {
			return err
		}
		if err = saveArticleReferences(ctx, tx, id, article); err != nil {
			return err
		}
	}
	seededAttachments := []struct {
		articleID  int64
		filename   string
		mimeType   string
		storedName string
		content    string
	}{
		{1, "stillstands-checkliste.csv", "text/csv; charset=utf-8", "attachment-seed-01-stillstands-checkliste.csv", "Schritt;Verantwortlich;Status\nArbeitsfreigabe geprüft;Stillstandsleitung;offen\nErsatzteile verfügbar;Instandhaltung;offen\nSchichtübergabe geplant;Produktion;offen\nWiederanlauf freigegeben;Betriebsleitung;offen\n"},
		{2, "datenbank-restore-runbook.md", "text/markdown; charset=utf-8", "attachment-seed-02-datenbank-restore.md", "# Restore-Kommandokarte\n\n- Schreibzugriffe sperren\n- Backup und WAL-Zielzeit bestätigen\n- Restore isoliert ausführen\n- Integritätsabfragen protokollieren\n- Fachliche Freigabe einholen\n"},
		{3, "materialstamm-pruefung.csv", "text/csv; charset=utf-8", "attachment-seed-03-materialstamm-pruefung.csv", "Prüffeld;Regel;Kritikalität\nBasismengeneinheit;Pflichtfeld;hoch\nMaterialgruppe;Im Zielkatalog vorhanden;hoch\nKurztext;Mindestens 10 Zeichen;mittel\nWerkssicht;Für aktive Werke vorhanden;hoch\n"},
		{4, "energie-dashboard-datenwoerterbuch.md", "text/markdown; charset=utf-8", "attachment-seed-04-energie-datenwoerterbuch.md", "# Datenwörterbuch\n\n| Kennzahl | Einheit | Definition |\n| --- | --- | --- |\n| Stromverbrauch | kWh | Gemessener Netzbezug |\n| Dampfverbrauch | t | Abgerechnete Dampfmenge |\n| Energieintensität | kWh/t | Strom je Produktionsmenge |\n"},
		{5, "genai-review-checkliste.txt", "text/plain; charset=utf-8", "attachment-seed-05-genai-review.txt", "GenAI Pilot Review\n\n[ ] Geschäftsnutzen messbar\n[ ] Datenklassifizierung geklärt\n[ ] Menschliche Prüfung festgelegt\n[ ] Risiken dokumentiert\n[ ] Abbruchkriterien definiert\n"},
		{11, "incident-kommandokarte.md", "text/markdown; charset=utf-8", "attachment-seed-11-incident-kommandokarte.md", "# Incident-Kommandokarte\n\n1. Auswirkung benennen\n2. Incident Lead bestimmen\n3. Änderungen stoppen\n4. Letzte Deployments prüfen\n5. Mitigation dokumentieren\n6. Status alle 15 Minuten aktualisieren\n"},
		{12, "formulierung-uebergabe.txt", "text/plain; charset=utf-8", "attachment-seed-12-formulierung-uebergabe.txt", "Formulierungsübergabe\n\nZielanwendung:\nRezepturversion:\nHerstellreihenfolge:\nPrüfmethoden:\nBekannte Grenzen:\nAnsprechpartner Labor:\nAnsprechpartner Customer Solutions:\n"},
	}
	for _, attachment := range seededAttachments {
		if _, err = tx.ExecContext(ctx, `INSERT INTO attachments (article_id, filename, mime_type, size_bytes, stored_name) VALUES ($1, $2, $3, $4, $5)`, attachment.articleID, attachment.filename, attachment.mimeType, len(attachment.content), attachment.storedName); err != nil {
			return err
		}
	}
	if err := tx.Commit(); err != nil {
		return err
	}
	entries, err := os.ReadDir(attachmentDir)
	if err != nil {
		return err
	}
	for _, entry := range entries {
		if strings.HasPrefix(entry.Name(), "attachment-") {
			if err := os.Remove(filepath.Join(attachmentDir, entry.Name())); err != nil {
				return err
			}
		}
	}
	for _, attachment := range seededAttachments {
		if err := os.WriteFile(filepath.Join(attachmentDir, attachment.storedName), []byte(attachment.content), 0600); err != nil {
			return err
		}
	}
	return nil
}
