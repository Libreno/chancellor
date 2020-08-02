import React from 'react'
import Panel from '@vkontakte/vkui/dist/components/Panel/Panel'
import Button from '@vkontakte/vkui/dist/components/Button/Button'
import '../styles/style.css'
import { PanelHeader } from '@vkontakte/vkui'

const StartScreen = ({id, go}: any) => {
    return (
        <Panel id={id}>
            <PanelHeader>Мои друзья и их сообщества</PanelHeader>
            <div id='allfriends-start-screen'>
                <div className="paragraph">1. Приложение выводит список групп, в которых состоят Ваши друзья.</div>
                <div className="paragraph">2. Можно анализировать профиль любого пользователя, чьи данные Вам доступны.</div>
                <div className="paragraph">3. В результаты не включаются данные самого пользователя, только данные его друзей.</div>
                <div className="paragraph">4. Список будет отсортирован в порядке убывания числа друзей в группах.</div>
                <div className="paragraph">
                    5. Каждый элемент списка имеет вид:</div>
                    <div>
                        <div className="paragraph" id="allfriends-groups-list">
                            <div className='allfriends-vk-group-card'>
                                <div className='group-name'>N. [K]&nbsp;"Название группы"</div>
                                <div className='group-id'>ИД группы</div>
                            </div>
                        </div>
                        <div className="paragraph">Где N - порядковый номер группы в списке, K - количество друзей пользователя, которые в ней состоят.</div>
                    </div>
                <div className="paragraph">5. Из-за ограничений API ВКонтакте получение данных может занять существенное время. 
                Во время работы приложения будет выводиться часть промежуточных результатов, которая может быть увеличена нажатием 
                на кнопу "Показать ещё", свайпом вниз или скроллиногом колёсика мыши.</div>
                <div className="paragraph">Увеличение количества отображаемых промежуточных результатов 
                замедляет ход процесса тем заметнее, чем больше у пользователя друзей.</div>
                <div className="paragraph">6. Никакие персональные данные с Вашего устройства приложением никуда не отправляются и нигде не сохраняются, 
                никакой слежки ни за Вами ни за Вашими друзьями не ведётся.</div>
            </div>
            <Button stretched size = "xl" onClick={go}>Начать</Button>
        </Panel>)
}

export default StartScreen
