// Copyright © 2020, Farkhad Muminov. All rights reserved.
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
                <div className="paragraph">Приветствую Вас, дорогой Пользователь и спасибо, что открыли приложение! Расскажу кратко о том, как им пользоваться,
                чем оно может быть для Вас полезным и другую интересную информацию:</div>
                <div className="paragraph">1. Приложение выводит список групп, в которых состоят Ваши друзья, которые раскрыли информацию о своих группах.</div>
                <div className="paragraph">2. Можно анализировать не только Ваш, а профиль любого пользователя, чьи данные Вам доступны.</div>
                <div className="paragraph">3. В результаты не включаются данные самого анализируемого пользователя, только данные его друзей.</div>
                <div className="paragraph">
                    4. Каждый элемент результирующего списка имеет вид:</div>
                    <div>
                        <div className="paragraph" id="allfriends-groups-list">
                            <div className='allfriends-vk-group-card'>
                                <div className='group-name'>N. [K]&nbsp;"Название группы"</div>
                                <div className='group-id'>ИД группы</div>
                            </div>
                        </div>
                        <div className="paragraph">Где N - порядковый номер группы в списке в порядке убывания количества друзей,</div>
                        <div className="paragraph">K - количество друзей пользователя, которые в ней состоят.</div>
                    </div>
                <div className="paragraph">5. Из-за ограничений API ВКонтакте получение данных может занять существенное время. 
                В процессе будут выводиться группы с наибольшим количеством друзей, их количество может быть увеличено нажатием 
                на кнопку "Показать ещё", свайпом вниз или скроллиногом колёсика мыши.</div>
                <div className="paragraph">6. Никакие персональные данные с Вашего устройства приложением никуда не отправляются. 
                Приложение не имеет серверной части, а весь исходный код доступен под модифицированной лицензией BDS по адресу:<pre>https://github.com/Libreno/chancellor.git.</pre></div>
                <div className="paragraph">7. Приложение является бесплатным, но, если Вы хотите поддержать разработчика, можете отправить любую сумму 
                на счёт: <pre>в Сбербанке 4817 7601 2491 8404</pre> или <pre>в Альфа-банке 4081 7810 2086 7001 8460</pre></div>
                <div className="paragraph">8. Сообщения об ошибках, вопросы, замечания и предложения о сотрудничестве можно отправлять мне в личку: <pre>https://vk.com/fmuminov</pre></div>
                <div className="paragraph">Спасибо за внимание. Желаю Вам здоровья и интересных результатов!</div>
            </div>
            <Button stretched size = "xl" onClick={go}>Начать</Button>
        </Panel>)
}

export default StartScreen
