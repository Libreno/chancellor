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
                <div className="paragraph">3. Список будет отсортирован в порядке убывания числа друзей в группах.</div>
                <div className="paragraph">
                    4. Каждый элемент списка имеет вид:</div>
                    <div>
                        <div className="paragraph" id="allfriends-groups-list">
                            <div className='allfriends-vk-group-card'>
                                <div className='group-name'>[N]&nbsp;"Название группы"</div>
                                <div className='group-id'>ИД группы</div>
                            </div>
                        </div>
                        <div className="paragraph">Где N - количество друзей в данной группе.</div>
                    </div>
                <div className="paragraph">4. Если у данного пользователя сотни или тысячи друзей, получение данных займёт 
                продолжительное время в связи с ограничениями API ВКонтакте. До получения всех данных будет выведена только часть промежуточных результатов, 
                которая может быть увеличена нажатием на кнопу "Показать ещё", свайпом вниз или скроллиногом колёсика мыши.</div>
                <div className="paragraph">Увеличение количества отображаемых промежуточных результатов 
                тем заметнее будет замедлять ход процесса, чем больше у пользователя друзей.</div>
                <div className="paragraph">5. Никакие персональные данные с Вашего устройства приложением никуда не отправляются и нигде не сохраняются.</div>
            </div>
            <Button stretched size = "xl" onClick={go}>Показать</Button>
        </Panel>)
}

export default StartScreen
