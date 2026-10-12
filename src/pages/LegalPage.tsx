import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Logo } from '@/components/ui/Logo'
import { useT } from '@/i18n/I18nProvider'

/**
 * Legal pages required for a French website (LCEN art. 6, RGPD art. 13).
 * Written in French only: French law applies and these texts are not
 * translated approximations. Update LEGAL when the publisher details change.
 */
const LEGAL = {
  publisher: 'Lucas Mettetal',
  contactEmail: 'lucas.mettetal2@gmail.com',
  lastUpdated: '12 octobre 2026',
} as const

function LegalLayout({ title, children }: { title: string; children: ReactNode }) {
  const t = useT()
  return (
    <div className="min-h-dvh bg-bg">
      <header className="flex items-center justify-between border-b-2 border-line bg-surface px-4 py-3 sm:px-8">
        <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-fg-muted hover:text-fg">
          <ArrowLeft className="size-4" /> {t('common.back')}
        </Link>
        <Link to="/" aria-label="Tiltt">
          <Logo />
        </Link>
      </header>
      <main lang="fr" className="mx-auto max-w-3xl px-4 py-10 sm:px-8 [&_h2]:mt-8 [&_h2]:mb-2 [&_h2]:text-xl [&_h2]:font-bold [&_li]:ml-5 [&_li]:list-disc [&_p]:mb-3 [&_p]:leading-relaxed [&_ul]:mb-3">
        <h1 className="text-3xl font-extrabold">{title}</h1>
        <p className="text-sm text-fg-subtle">Dernière mise à jour : {LEGAL.lastUpdated}</p>
        {children}
      </main>
    </div>
  )
}

const mail = <a className="font-semibold underline" href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a>

export function LegalNoticePage() {
  return (
    <LegalLayout title="Mentions légales">
      <h2>Éditeur du site</h2>
      <p>
        Le site tiltt.fr est édité à titre non professionnel par {LEGAL.publisher}. Contact : {mail}.
      </p>
      <p>Directeur de la publication : {LEGAL.publisher}.</p>

      <h2>Hébergement</h2>
      <p>
        Site : Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, États-Unis — vercel.com.
        <br />
        Base de données, comptes et fichiers : Supabase Inc. — supabase.com.
      </p>

      <h2>Propriété intellectuelle</h2>
      <p>
        Le code, le nom et l’identité visuelle de Tiltt appartiennent à leur auteur. Les quiz publiés restent la propriété de
        leurs créateurs, qui garantissent disposer des droits sur les textes et images qu’ils ajoutent.
      </p>

      <h2>Signaler un contenu</h2>
      <p>Pour signaler un quiz ou un pseudo illicite, écris à {mail} en indiquant le lien concerné.</p>
    </LegalLayout>
  )
}

export function PrivacyPage() {
  return (
    <LegalLayout title="Politique de confidentialité">
      <p className="mt-4">
        Responsable du traitement : {LEGAL.publisher} ({mail}). Tiltt ne vend aucune donnée, n’affiche aucune publicité et
        n’utilise aucun traceur publicitaire ni outil de mesure d’audience.
      </p>

      <h2>Données traitées</h2>
      <ul>
        <li>
          <strong>Créateurs (compte)</strong> : adresse e-mail, mot de passe (jamais stocké en clair : Supabase n’en conserve qu’une empreinte), nom affiché, avatar,
          langue, quiz créés, favoris et résultats des parties animées. Base légale : exécution du service demandé.
        </li>
        <li>
          <strong>Connexion avec Google</strong> (si utilisée) : adresse e-mail et nom transmis par Google.
        </li>
        <li>
          <strong>Joueurs</strong> : aucun compte n’est demandé. Un identifiant anonyme est créé dans le navigateur, avec le
          pseudo, l’avatar, les réponses et le score de la partie. Base légale : exécution du service demandé.
        </li>
        <li>
          <strong>Données techniques</strong> : journaux de connexion conservés par nos hébergeurs pour la sécurité du service.
        </li>
      </ul>

      <h2>Destinataires et hébergement</h2>
      <p>
        Les données sont hébergées par Supabase (base de données, authentification, fichiers) et Vercel (site). Ces prestataires
        agissent comme sous-traitants. Certains peuvent traiter des données hors de l’Union européenne, sous les garanties
        prévues par le RGPD (clauses contractuelles types).
      </p>

      <h2>Durée de conservation</h2>
      <ul>
        <li>Compte créateur : tant que le compte existe. Il est supprimé sur simple demande.</li>
        <li>Parties et résultats : jusqu’à leur suppression par l’hôte, ou jusqu’à la suppression de son compte.</li>
      </ul>

      <h2>Stockage dans le navigateur</h2>
      <p>
        Tiltt n’utilise pas de cookies publicitaires. Le navigateur conserve uniquement ce qui est nécessaire au fonctionnement :
        la session de connexion, la langue, le thème clair ou sombre, le dernier pseudo et avatar utilisés, et les parties
        récentes pour pouvoir s’y reconnecter. Ces éléments étant indispensables, aucun consentement n’est requis.
      </p>

      <h2>Tes droits</h2>
      <p>
        Tu peux demander l’accès, la rectification, l’effacement ou la portabilité de tes données, ou t’opposer à leur traitement,
        en écrivant à {mail}. Une réponse est apportée sous un mois. Tu peux aussi saisir la CNIL (cnil.fr).
      </p>
    </LegalLayout>
  )
}
