<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class EmailLog extends Model
{
    protected $table = 'email_logs';
    protected $keyType = 'string';
    public $incrementing = false;
    protected $fillable = ['to', 'from', 'subject', 'status', 'provider', 'template_key', 'error', 'metadata', 'sent_at'];


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
