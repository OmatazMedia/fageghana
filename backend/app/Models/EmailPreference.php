<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class EmailPreference extends Model
{
    protected $table = 'email_preferences';
    protected $keyType = 'string';
    public $incrementing = false;
    protected $fillable = ['user_id', 'newsletters', 'event_alerts', 'trade_notices', 'payment_reminders'];


    protected static function boot()
    {
        parent::boot();
        static::creating(function ($model) {
            if (empty($model->id)) {
                $model->id = \Illuminate\Support\Str::uuid()->toString();
            }
        });
    }
}
