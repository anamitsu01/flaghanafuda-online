import { FLAGS } from "@/lib/flags";
import { BONUS_MIN_ROLES, BONUS_POINTS, HOLD_LIMIT, MARKET_SIZE, NAME_GOAL, ROLE_SIZE, TAKES_PER_TURN } from "@/lib/types";

export default function RulesPanel({ defaultOpen = false }: { defaultOpen?: boolean }) {
  return (
    <details open={defaultOpen} className="rounded-xl border border-white/10 bg-panel/80 p-4 text-sm leading-relaxed">
      <summary className="cursor-pointer text-base font-bold text-ink">ルール</summary>
      <RulesContent className="mt-3" />
    </details>
  );
}

export function RulesContent({ className = "" }: { className?: string }) {
  return (
    <div className={`space-y-3 text-white/70 ${className}`}>
      <p>
        <b className="text-ink">目的</b>: 世界の国旗(全{FLAGS.length}種)を集めて役をそろえ、勝利点を競う。
      </p>
      <p>
        <b className="text-ink">手番</b>: 公開されている{MARKET_SIZE}枚と山札から、合わせて{TAKES_PER_TURN}枚の国旗を取る(公開2枚・公開1枚と山札1枚・山札2枚のどれでもよい)。
        公開の国旗は取ってもすぐには補充されず、手番が終わってから{MARKET_SIZE}枚に戻る。
      </p>
      <p>
        <b className="text-ink">置き場所</b>: 取った国旗は、色役・地域役・国名役のどれか1つに置く。
        公開から取った国旗は、その場で置き場所を決める。山札から引いた国旗は、すぐ置くか、<b className="text-ink">保留</b>(最大{HOLD_LIMIT}枚)にできる。
      </p>
      <p>
        <b className="text-ink">保留カード</b>: 自分の手番の最初、国旗を取る前にだけ、好きな枚数を役に置ける。
      </p>
      <p>
        <b className="text-ink">1ターン1枚</b>: 色役・地域役は、同じ役に1ターンで1枚しか置けない(保留カードも合わせて数える)。
        日本と韓国を取っても両方を赤役には置けない。国名役だけは何枚でも置ける。
      </p>
      <ul className="space-y-1">
        <li>
          <b className="text-ink">色役</b>(赤・白・青・緑・黄・黒): 同じ色を含む国旗を{ROLE_SIZE}枚で完成、1点。
        </li>
        <li>
          <b className="text-ink">地域役</b>(アジア・ヨーロッパ・アフリカ・アメリカ大陸・オセアニア): 同じ地域の国旗を{ROLE_SIZE}枚で完成、1点。
        </li>
        <li>
          <b className="text-ink">国名役</b>: 国名をつなげて合計{NAME_GOAL}文字以上で完成、1点。完成したあとも置き続けられる。どんな国旗でも置ける。「・」と( )の中は文字数に数えない。
        </li>
      </ul>
      <p>完成した色役・地域役には、もう置けない。同じ役をもう一度作ることもできない。</p>
      <p>
        <b className="text-ink">最多ボーナス</b>(各+{BONUS_POINTS}点): 色役をいちばん多く完成させた人({BONUS_MIN_ROLES}役以上)、
        地域役をいちばん多く完成させた人({BONUS_MIN_ROLES}役以上)、国名役がいちばん長い人(完成済み)。
        先に条件を満たした人が持ち、ほかの人が記録を<b className="text-ink">上回ったとき</b>にだけ移る(同数なら移らない)。
      </p>
      <p>
        <b className="text-ink">勝利</b>: だれかが勝利点に届いたら、そのラウンドの最後の人まで手番を回す。
        その時点で勝利点以上の人のうち、いちばん点が高い人の勝ち(同点なら同着1位)。
        ボーナスが移ってだれも届いていなければ、ゲームを続ける。
      </p>
      <p>
        <b className="text-ink">色の数え方</b>: 国旗の面積のおよそ2%以上を占める色を数える。オレンジや金色は黄、えんじ色は赤、水色や紺色は青として扱う。
        カードの色の丸が、その国旗で使える色。
      </p>
      <p className="text-white/45">山札と公開の国旗がなくなった場合は、そのラウンドの終わりにいちばん点が高い人の勝ち。</p>
    </div>
  );
}
